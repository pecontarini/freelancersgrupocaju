-- 1. Criar tabela user_stores (relacionamento N:N entre usuários e lojas)
CREATE TABLE public.user_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    loja_id UUID NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(user_id, loja_id)
);

-- 2. Habilitar RLS na tabela user_stores
ALTER TABLE public.user_stores ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS para user_stores
CREATE POLICY "Admins can manage user_stores" 
ON public.user_stores 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own stores" 
ON public.user_stores 
FOR SELECT 
USING (auth.uid() = user_id);

-- 4. Migrar dados existentes de profiles.unidade_id para user_stores
INSERT INTO public.user_stores (user_id, loja_id)
SELECT user_id, unidade_id
FROM public.profiles
WHERE unidade_id IS NOT NULL
ON CONFLICT (user_id, loja_id) DO NOTHING;

-- 5. Criar função para verificar acesso multi-loja
CREATE OR REPLACE FUNCTION public.user_has_access_to_loja(_user_id UUID, _loja_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_stores
        WHERE user_id = _user_id
          AND loja_id = _loja_id
    )
$$;

-- 6. Renomear tabela config_setores para config_funcoes
ALTER TABLE public.config_setores RENAME TO config_funcoes;

-- 7. Renomear coluna setor para funcao em freelancer_entries
ALTER TABLE public.freelancer_entries RENAME COLUMN setor TO funcao;

-- 8. Atualizar políticas RLS de freelancer_entries para usar a nova função
DROP POLICY IF EXISTS "View entries based on role" ON public.freelancer_entries;
DROP POLICY IF EXISTS "Insert entries based on role" ON public.freelancer_entries;
DROP POLICY IF EXISTS "Update entries based on role" ON public.freelancer_entries;
DROP POLICY IF EXISTS "Delete entries based on role" ON public.freelancer_entries;

CREATE POLICY "View entries based on role" 
ON public.freelancer_entries 
FOR SELECT 
USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "Insert entries based on role" 
ON public.freelancer_entries 
FOR INSERT 
WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "Update entries based on role" 
ON public.freelancer_entries 
FOR UPDATE 
USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "Delete entries based on role" 
ON public.freelancer_entries 
FOR DELETE 
USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.user_has_access_to_loja(auth.uid(), loja_id)
);

-- 9. Atualizar políticas da tabela config_funcoes (antiga config_setores)
DROP POLICY IF EXISTS "Anyone authenticated can view setores" ON public.config_funcoes;
DROP POLICY IF EXISTS "Only admins can manage setores" ON public.config_funcoes;

CREATE POLICY "Anyone authenticated can view funcoes" 
ON public.config_funcoes 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can manage funcoes" 
ON public.config_funcoes 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));