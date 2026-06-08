-- auth_setup_patch.sql
-- Corrige dois problemas deixados pelo auth_setup.sql:
-- 1. Faltou a policy SELECT → renderAdmin retornava vazio (você não via ninguém esperando aprovação)
-- 2. Policy UPDATE só permitia o próprio usuário editar o próprio perfil → aprovar/revogar falhava silenciosamente

-- 1. Policy SELECT: qualquer autenticado pode ler todos os perfis
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_profiles'
    AND policyname='autenticados leem perfis'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "autenticados leem perfis"
      ON public.user_profiles
      FOR SELECT
      USING (auth.role() = 'authenticated')
    $p$;
  END IF;
END $$;

-- 2. Substitui a policy UPDATE restrita pela versão que permite admin gerenciar qualquer perfil
DROP POLICY IF EXISTS "usuario atualiza proprio perfil" ON public.user_profiles;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_profiles'
    AND policyname='autenticados atualizam perfis'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "autenticados atualizam perfis"
      ON public.user_profiles
      FOR UPDATE
      USING (auth.role() = 'authenticated')
    $p$;
  END IF;
END $$;
