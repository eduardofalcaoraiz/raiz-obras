-- Pausa segura do scheduler interno do Supabase para o Ticket Raiz CAPEX.
-- A orquestracao principal deve ficar no GitHub Actions, com health-check,
-- circuit breaker e concorrencia unica. Este arquivo remove jobs antigos
-- e nao recria novos para evitar agendamentos sobrepostos.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  job text;
  existing record;
begin
  foreach job in array array[
    'zeev-capex-sync-every-5-min',
    'zeev-capex-sync-every-10-min',
    'zeev-capex-sync-5min',
    'zeev-capex-sync-flow-299',
    'zeev-capex-sync-flow-275',
    'zeev-capex-sync-flow-102',
    'zeev-capex-sync-flow-300',
    'zeev-capex-sync-github-catchup-30min',
    'zeev-capex-sync-github-catchup-hourly'
  ] loop
    begin
      perform cron.unschedule(job);
    exception when others then
      null;
    end;
  end loop;

  for existing in
    select jobid, jobname
    from cron.job
    where command ilike '%zeev-capex-sync%'
       or jobname ilike '%zeev%'
  loop
    begin
      perform cron.unschedule(existing.jobid);
    exception when others then
      begin
        perform cron.unschedule(existing.jobname);
      exception when others then
        null;
      end;
    end;
  end loop;
end
$$;

select 'zeev-capex pg_cron jobs pausados; reativar somente apos validacao da fila online' as status;
