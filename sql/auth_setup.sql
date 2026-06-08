-- auth_setup.sql
-- Roda UMA VEZ no Supabase SQL Editor
-- Cria trigger + policy para que novos cadastros apareçam automaticamente no painel de admin

-- 1. Função que cria o perfil assim que um usuário se cadastra no Auth
--    SECURITY DEFINER garante que roda com permissão elevada, ignorando RLS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, nome, role, aprovado)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'leitor'),
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email    = EXCLUDED.email,
    nome     = COALESCE(EXCLUDED.nome,     user_profiles.nome),
    role     = COALESCE(EXCLUDED.role,     user_profiles.role),
    aprovado = user_profiles.aprovado;  -- nunca sobrescreve aprovação existente
  RETURN NEW;
END;
$$;

-- 2. Recria o trigger (remove se já existir)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Policy RLS de fallback: usuário autenticado pode inserir/atualizar o próprio perfil
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_profiles'
    AND policyname='usuario insere proprio perfil'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "usuario insere proprio perfil"
      ON public.user_profiles
      FOR INSERT
      WITH CHECK (auth.uid() = id)
    $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_profiles'
    AND policyname='usuario atualiza proprio perfil'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "usuario atualiza proprio perfil"
      ON public.user_profiles
      FOR UPDATE
      USING (auth.uid() = id)
    $p$;
  END IF;
END $$;
