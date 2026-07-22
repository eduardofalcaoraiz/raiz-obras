-- Manutencao leve para manter o Supabase Free saudavel.
-- Nao remove dados de negocio, pagamentos, CAPEX, escolas, anexos ou documentos.
-- Limpa apenas payloads brutos reconstruiveis do Zeev e logs tecnicos antigos.

create extension if not exists pg_cron with schema extensions;

create or replace function public.raiz_free_tier_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public, cron
as $$
declare
  cleaned_raw_payloads integer := 0;
  cleaned_treated_fields integer := 0;
  cleaned_capex_payloads integer := 0;
  deleted_cron_logs integer := 0;
begin
  update public.capex_zeev_solicitacoes
     set raw_instance = '{}'::jsonb,
         raw_tasks = '[]'::jsonb,
         enrichment_errors = case
           when jsonb_array_length(coalesce(enrichment_errors, '[]'::jsonb)) > 5
             then (
               select coalesce(jsonb_agg(value), '[]'::jsonb)
               from (
                 select value
                 from jsonb_array_elements(enrichment_errors)
                 limit 5
               ) limited
             )
           else coalesce(enrichment_errors, '[]'::jsonb)
         end
   where coalesce(raw_instance, '{}'::jsonb) <> '{}'::jsonb
      or coalesce(raw_tasks, '[]'::jsonb) <> '[]'::jsonb
      or jsonb_array_length(coalesce(enrichment_errors, '[]'::jsonb)) > 5;
  get diagnostics cleaned_raw_payloads = row_count;

  update public.capex_zeev_solicitacoes
     set raw_fields = '[]'::jsonb
   where status in ('aprovado', 'ignorado', 'erro')
     and coalesce(raw_fields, '[]'::jsonb) <> '[]'::jsonb;
  get diagnostics cleaned_treated_fields = row_count;

  update public.capex_itens
     set ticket_raiz_dados = jsonb_strip_nulls(
       ticket_raiz_dados - 'rawFields' - 'rawInstance' - 'rawTasks'
     )
   where ticket_raiz_dados ?| array['rawFields', 'rawInstance', 'rawTasks'];
  get diagnostics cleaned_capex_payloads = row_count;

  delete from cron.job_run_details
   where start_time < now() - interval '2 days';
  get diagnostics deleted_cron_logs = row_count;

  analyze public.capex_zeev_solicitacoes;
  analyze public.capex_itens;
  analyze cron.job_run_details;

  return jsonb_build_object(
    'ok', true,
    'cleanedRawPayloads', cleaned_raw_payloads,
    'cleanedTreatedFields', cleaned_treated_fields,
    'cleanedCapexPayloads', cleaned_capex_payloads,
    'deletedCronLogs', deleted_cron_logs,
    'ranAt', now()
  );
end;
$$;

do $do$
begin
  begin
    perform cron.unschedule('raiz-free-tier-maintenance');
  exception when others then
    null;
  end;

  perform cron.schedule(
    'raiz-free-tier-maintenance',
    '12 3 * * *',
    $cmd$select public.raiz_free_tier_maintenance();$cmd$
  );
end
$do$;

select public.raiz_free_tier_maintenance() as first_run;
