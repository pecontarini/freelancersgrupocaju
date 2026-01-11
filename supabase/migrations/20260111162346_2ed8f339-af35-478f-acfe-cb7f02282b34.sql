-- 1. Limpar dados existentes
TRUNCATE TABLE public.freelancer_entries;

-- 2. Criar enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'gerente_unidade');

-- 3. Criar tabela de profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    unidade_id UUID REFERENCES public.config_lojas(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Criar tabela de roles separada (segurança)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 5. Adicionar coluna loja_id na tabela freelancer_entries
ALTER TABLE public.freelancer_entries 
ADD COLUMN loja_id UUID REFERENCES public.config_lojas(id) ON DELETE CASCADE;

-- 6. Habilitar RLS nas novas tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 7. Função para verificar se usuário tem role específico (security definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- 8. Função para obter unidade_id do usuário (security definer)
CREATE OR REPLACE FUNCTION public.get_user_unidade_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT unidade_id
    FROM public.profiles
    WHERE user_id = _user_id
$$;

-- 9. Função para verificar se é o primeiro usuário (para auto-admin)
CREATE OR REPLACE FUNCTION public.is_first_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1)
$$;

-- 10. Trigger para criar profile e role automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    is_first BOOLEAN;
BEGIN
    -- Verificar se é o primeiro usuário
    SELECT public.is_first_user() INTO is_first;
    
    -- Criar profile
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    
    -- Se for o primeiro usuário, dar role de admin
    IF is_first THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'admin');
    END IF;
    
    RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 11. RLS Policies para profiles
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 12. RLS Policies para user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 13. Atualizar RLS para freelancer_entries (multi-tenant)
DROP POLICY IF EXISTS "Authenticated users can view all entries" ON public.freelancer_entries;
DROP POLICY IF EXISTS "Authenticated users can insert entries" ON public.freelancer_entries;
DROP POLICY IF EXISTS "Authenticated users can update own entries" ON public.freelancer_entries;
DROP POLICY IF EXISTS "Authenticated users can delete own entries" ON public.freelancer_entries;

-- Admin vê tudo, gerente só vê da sua unidade
CREATE POLICY "View entries based on role"
ON public.freelancer_entries
FOR SELECT
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') 
    OR loja_id = public.get_user_unidade_id(auth.uid())
);

-- Insert: admin pode em qualquer loja, gerente só na sua
CREATE POLICY "Insert entries based on role"
ON public.freelancer_entries
FOR INSERT
TO authenticated
WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    OR loja_id = public.get_user_unidade_id(auth.uid())
);

-- Update: admin pode em qualquer loja, gerente só na sua
CREATE POLICY "Update entries based on role"
ON public.freelancer_entries
FOR UPDATE
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') 
    OR loja_id = public.get_user_unidade_id(auth.uid())
);

-- Delete: admin pode em qualquer loja, gerente só na sua
CREATE POLICY "Delete entries based on role"
ON public.freelancer_entries
FOR DELETE
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') 
    OR loja_id = public.get_user_unidade_id(auth.uid())
);

-- 14. Atualizar RLS para config_lojas (apenas admin pode gerenciar)
DROP POLICY IF EXISTS "Allow all operations on config_lojas" ON public.config_lojas;

CREATE POLICY "Anyone authenticated can view lojas"
ON public.config_lojas
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can manage lojas"
ON public.config_lojas
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 15. Atualizar RLS para config_setores (apenas admin pode gerenciar)
DROP POLICY IF EXISTS "Allow all operations on config_setores" ON public.config_setores;

CREATE POLICY "Anyone authenticated can view setores"
ON public.config_setores
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can manage setores"
ON public.config_setores
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 16. Atualizar RLS para config_gerencias (apenas admin pode gerenciar)
DROP POLICY IF EXISTS "Allow all operations on config_gerencias" ON public.config_gerencias;

CREATE POLICY "Anyone authenticated can view gerencias"
ON public.config_gerencias
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can manage gerencias"
ON public.config_gerencias
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 17. Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger para profiles
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();