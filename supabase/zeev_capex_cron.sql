-- Online scheduler for Ticket Raiz CAPEX sync.
-- The plaintext secret must live only in Supabase Edge Function secrets
-- as ZEEV_DB_CRON_SECRET and in Supabase Vault as zeev_db_cron_secret.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  job text;
begin
  foreach job in array array[
    'zeev-capex-sync-every-5-min',
    'zeev-capex-sync-5min',
    'zeev-capex-sync-flow-299',
    'zeev-capex-sync-flow-275',
    'zeev-capex-sync-flow-102',
    'zeev-capex-sync-flow-300',
    'zeev-capex-sync-github-catchup-30min'
  ] loop
    begin
      perform cron.unschedule(job);
    exception when others then
      null;
    end;
  end loop;
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
        'target', 'github',
        'workflowMode', 'deep-incremental',
        'businessTimezone', 'America/Sao_Paulo',
        'flowIds', '299,275,102,300',
        'maxPages', 2,
        'recordsPerPage', 30,
        'refreshKnownTickets', true,
        'refreshLimit', 12,
        'notify', true,
        'source', 'supabase-pg-cron'
      ),
      timeout_milliseconds := 180000
    );
  $cron$
);

select cron.schedule(
  'zeev-capex-sync-github-catchup-30min',
  '4,34 * * * *',
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
        'target', 'github',
        'workflowMode', 'deep-incremental',
        'flowIds', '299,275,102,300',
        'maxPages', 12,
        'refreshKnownTickets', true,
        'refreshLimit', 60,
        'notify', true,
        'source', 'supabase-pg-cron-catchup'
      ),
      timeout_milliseconds := 60000
    );
  $cron$
);
