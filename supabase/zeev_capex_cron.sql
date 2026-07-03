-- Online scheduler for Ticket Raiz CAPEX sync.
-- The plaintext secret must live only in Supabase Edge Function secrets
-- as ZEEV_DB_CRON_SECRET and in Supabase Vault as zeev_db_cron_secret.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule('zeev-capex-sync-every-5-min');
exception when others then
  null;
end
$$;

select cron.schedule(
  'zeev-capex-sync-every-5-min',
  '*/5 * * * *',
  $cron$
    select net.http_post(
      url := 'https://hjccxfznojjosvanwztv.supabase.co/functions/v1/zeev-capex-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'zeev_db_cron_secret'),
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'zeev_db_cron_secret')
      ),
      body := jsonb_build_object(
        'mode', 'dispatch',
        'target', 'vercel',
        'workflowMode', 'incremental',
        'businessTimezone', 'America/Sao_Paulo',
        'maxPages', 6,
        'recordsPerPage', 30,
        'notify', true,
        'source', 'supabase-pg-cron'
      ),
      timeout_milliseconds := 180000
    );
  $cron$
);
