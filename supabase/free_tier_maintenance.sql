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

create or replace function public.raiz_storage_objects_for_maintenance(
  p_bucket text default null,
  p_min_bytes bigint default 0,
  p_limit integer default 500
)
returns table (
  bucket_id text,
  name text,
  size_bytes bigint,
  etag text,
  mimetype text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, storage
as $$
  select
    o.bucket_id,
    o.name,
    coalesce((o.metadata->>'size')::bigint, 0) as size_bytes,
    coalesce(o.metadata->>'eTag', o.metadata->>'etag', '') as etag,
    coalesce(o.metadata->>'mimetype', o.metadata->>'mimeType', '') as mimetype,
    o.updated_at
  from storage.objects o
  where (p_bucket is null or o.bucket_id = p_bucket)
    and coalesce((o.metadata->>'size')::bigint, 0) >= coalesce(p_min_bytes, 0)
  order by coalesce((o.metadata->>'size')::bigint, 0) desc, o.updated_at asc nulls last
  limit greatest(1, least(coalesce(p_limit, 500), 5000));
$$;

create or replace function public.raiz_rewrite_storage_path(
  p_bucket text,
  p_old_path text,
  p_new_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pagamentos_docs integer := 0;
  pagamentos_nf integer := 0;
  pagamentos_comp integer := 0;
  pending_docs integer := 0;
  capex_docs integer := 0;
  unidade_docs integer := 0;
begin
  if coalesce(p_old_path, '') = '' or coalesce(p_new_path, '') = '' or p_old_path = p_new_path then
    return jsonb_build_object('ok', false, 'reason', 'invalid_paths');
  end if;

  if p_bucket = 'pagamentos' then
    update public.pagamentos
       set nf_doc_path = p_new_path
     where nf_doc_path = p_old_path;
    get diagnostics pagamentos_nf = row_count;

    update public.pagamentos
       set comp_doc_path = p_new_path
     where comp_doc_path = p_old_path;
    get diagnostics pagamentos_comp = row_count;

    update public.pagamentos
       set docs_json = replace(docs_json::text, to_jsonb(p_old_path)::text, to_jsonb(p_new_path)::text)::jsonb
     where docs_json::text like '%' || p_old_path || '%';
    get diagnostics pagamentos_docs = row_count;

    update public.capex_zeev_solicitacoes
       set docs_json = replace(docs_json::text, to_jsonb(p_old_path)::text, to_jsonb(p_new_path)::text)::jsonb
     where docs_json::text like '%' || p_old_path || '%';
    get diagnostics pending_docs = row_count;

    update public.capex_itens
       set docs_json = replace(docs_json::text, to_jsonb(p_old_path)::text, to_jsonb(p_new_path)::text)::jsonb
     where docs_json::text like '%' || p_old_path || '%';
    get diagnostics capex_docs = row_count;
  elsif p_bucket = 'documentos' then
    update public.documentos_unidade
       set storage_path = p_new_path
     where storage_path = p_old_path;
    get diagnostics unidade_docs = row_count;
  end if;

  return jsonb_build_object(
    'ok', true,
    'bucket', p_bucket,
    'oldPath', p_old_path,
    'newPath', p_new_path,
    'pagamentosDocs', pagamentos_docs,
    'pagamentosNf', pagamentos_nf,
    'pagamentosComp', pagamentos_comp,
    'pendingDocs', pending_docs,
    'capexDocs', capex_docs,
    'unidadeDocs', unidade_docs
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
