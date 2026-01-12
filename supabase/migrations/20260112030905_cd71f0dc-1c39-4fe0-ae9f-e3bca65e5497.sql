-- Criar trigger para novos usuários (precisa ser na schema auth)
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Criar profiles para usuários existentes que não têm
INSERT INTO public.profiles (user_id, full_name)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', email)
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles);

-- O primeiro usuário a cadastrar (vou usar o primeiro por ordem de criação) vira admin
-- Verificar se já existe algum admin
DO $$
DECLARE
    first_user_id UUID;
BEGIN
    -- Se não existe nenhum role ainda, pegar o primeiro usuário e torná-lo admin
    IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
        SELECT id INTO first_user_id 
        FROM auth.users 
        ORDER BY created_at ASC 
        LIMIT 1;
        
        IF first_user_id IS NOT NULL THEN
            INSERT INTO public.user_roles (user_id, role)
            VALUES (first_user_id, 'admin');
        END IF;
    END IF;
END $$;