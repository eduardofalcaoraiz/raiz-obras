create or replace function public.raiz_safe_jsonb_array(value jsonb)
returns jsonb
language sql
immutable
as $$
  select case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end;
$$;

create or replace function public.raiz_doc_kind_from_text(value text)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(value, '')) ~ '(comprovante.*pagamento|pagamento.*comprovante|pgfor|liquidado|pix)' then 'COMPROVANTE'
    when lower(coalesce(value, '')) ~ '(boleto)' then 'BOLETO'
    when lower(coalesce(value, '')) ~ '(fatura)' then 'FATURA'
    when lower(coalesce(value, '')) ~ '(recibo)' then 'RECIBO'
    when lower(coalesce(value, '')) ~ '(danfe|nfs-?e|nf-?e|nota.?fiscal|xml)' then 'NF'
    else 'DOCUMENTO'
  end;
$$;

create or replace function public.raiz_doc_rescue_audit(
  recent_hours integer default 24,
  sample_limit integer default 60,
  stale_hours integer default 720
)
returns jsonb
language sql
stable
as $$
with params as (
  select
    greatest(1, least(coalesce(recent_hours, 24), 168))::int as recent_hours,
    greatest(10, least(coalesce(sample_limit, 60), 300))::int as sample_limit,
    greatest(1, least(coalesce(stale_hours, 720), 4320))::int as stale_hours
),
base as (
  select
    'payment'::text as target,
    p.id::bigint as row_id,
    p.ticket_raiz::text as tr,
    p.docs_json,
    p.nf_doc_path,
    p.comp_doc_path,
    p.zeev_docs_checked_at,
    p.st::text as status
  from public.pagamentos p
  where p.ticket_raiz ~ '^\d+$'

  union all

  select
    'pending'::text as target,
    z.id::bigint as row_id,
    z.zeev_instance_id::text as tr,
    z.docs_json,
    null::text as nf_doc_path,
    null::text as comp_doc_path,
    z.zeev_docs_checked_at,
    z.status::text as status
  from public.capex_zeev_solicitacoes z
  where z.zeev_instance_id is not null

  union all

  select
    'capex'::text as target,
    c.id::bigint as row_id,
    coalesce(c.ticket_raiz_instance_id::text, nullif(regexp_replace(coalesce(c.referencia, ''), '\D', '', 'g'), '')) as tr,
    c.docs_json,
    null::text as nf_doc_path,
    null::text as comp_doc_path,
    c.zeev_docs_checked_at,
    c.situacao::text as status
  from public.capex_itens c
  where coalesce(c.ticket_raiz_instance_id::text, nullif(regexp_replace(coalesce(c.referencia, ''), '\D', '', 'g'), '')) ~ '^\d+$'
),
clean as (
  select
    b.*,
    b.tr::bigint as tr_num,
    public.raiz_safe_jsonb_array(b.docs_json) as docs,
    lower(coalesce(b.docs_json::text, '') || ' ' || coalesce(b.nf_doc_path, '') || ' ' || coalesce(b.comp_doc_path, '')) as doc_text,
    case when jsonb_typeof(b.docs_json) = 'array' then jsonb_array_length(b.docs_json) else 0 end as doc_count
  from base b
  where b.tr ~ '^\d+$'
),
states as (
  select
    c.*,
    (c.doc_count > 0 or nullif(c.nf_doc_path, '') is not null or nullif(c.comp_doc_path, '') is not null) as has_any,
    (nullif(c.nf_doc_path, '') is not null or c.doc_text ~ '(danfe|nfs-?e|nf-?e|nota.?fiscal|xml|recibo|fatura)') as has_fiscal,
    (c.doc_text ~ '(boleto)') as has_charge,
    (nullif(c.comp_doc_path, '') is not null or c.doc_text ~ '(comprovante.*pagamento|pagamento.*comprovante|pgfor|liquidado|pix)') as has_proof,
    (c.zeev_docs_checked_at is null) as never_checked,
    (
      c.zeev_docs_checked_at is not null
      and c.zeev_docs_checked_at >= now() - make_interval(hours => (select stale_hours from params))
    ) as fresh
  from clean c
),
queue as (
  select distinct tr_num
  from states
  where never_checked
     or not fresh
     or (target = 'payment' and not has_fiscal)
),
payment_fiscal_queue as (
  select distinct tr_num
  from states
  where target = 'payment'
    and not has_fiscal
    and (never_checked or not fresh)
),
recent_docs as (
  select
    s.tr_num,
    s.target,
    s.row_id,
    doc.value as doc,
    coalesce(doc.value->>'name', doc.value->>'fileName', doc.value->>'filename', '') as name,
    coalesce(doc.value->>'kind', doc.value->>'type', public.raiz_doc_kind_from_text(coalesce(doc.value->>'name', '') || ' ' || coalesce(doc.value->>'storagePath', doc.value->>'path', ''))) as kind,
    coalesce(doc.value->>'storagePath', doc.value->>'path', '') as storage_path,
    case
      when coalesce(doc.value->>'attachedAt', '') ~ '^\d{4}-\d{2}-\d{2}T' then (doc.value->>'attachedAt')::timestamptz
      else null::timestamptz
    end as attached_at
  from states s
  cross join lateral jsonb_array_elements(s.docs) doc(value)
),
recent_filtered as (
  select *
  from recent_docs
  where attached_at is not null
    and attached_at >= now() - make_interval(hours => (select recent_hours from params))
  order by attached_at desc
  limit (select sample_limit from params)
),
recent_grouped as (
  select
    tr_num,
    target,
    row_id,
    jsonb_agg(jsonb_build_object(
      'name', name,
      'kind', kind,
      'storagePath', storage_path,
      'attachedAt', attached_at
    ) order by attached_at desc) as attachments
  from recent_filtered
  group by tr_num, target, row_id
)
select jsonb_build_object(
  'ok', true,
  'mode', 'doc-rescue-audit',
  'implementation', 'postgres-rpc',
  'rows', jsonb_build_object(
    'payments', (select count(*) from states where target = 'payment'),
    'pending', (select count(*) from states where target = 'pending'),
    'capex', (select count(*) from states where target = 'capex')
  ),
  'uniqueTickets', (select count(distinct tr_num) from states),
  'docs', jsonb_build_object(
    'withAnyDocs', (select count(distinct tr_num) from states where has_any),
    'withFiscalDocs', (select count(distinct tr_num) from states where has_fiscal),
    'withChargeDocs', (select count(distinct tr_num) from states where has_charge),
    'withProofDocs', (select count(distinct tr_num) from states where has_proof)
  ),
  'checked', jsonb_build_object(
    'neverChecked', (select count(distinct tr_num) from states where never_checked),
    'fresh', (select count(distinct tr_num) from states where fresh),
    'staleOrMissing', (select count(distinct tr_num) from states where never_checked or not fresh)
  ),
  'audit', jsonb_build_object(
    'statusCounts', '{}'::jsonb,
    'attention', 0,
    'blocked', 0,
    'permission', 0,
    'partial', 0,
    'noDocsInZeev', 0,
    'attentionSample', '[]'::jsonb,
    'blockedSample', '[]'::jsonb,
    'permissionSample', '[]'::jsonb,
    'partialSample', '[]'::jsonb,
    'noDocsSample', '[]'::jsonb
  ),
  'queue', jsonb_build_object(
    'total', (select count(*) from queue),
    'paymentFiscal', (select count(*) from payment_fiscal_queue),
    'blocked', 0,
    'permission', 0,
    'partial', 0,
    'attention', 0,
    'strategy', 'postgres-rpc-doc-state',
    'sample', coalesce((select jsonb_agg(tr_num order by tr_num) from (select tr_num from queue order by tr_num limit (select sample_limit from params)) q), '[]'::jsonb)
  ),
  'recentAttached', jsonb_build_object(
    'total', (select count(*) from recent_filtered),
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tr', tr_num,
        'target', target,
        'rowId', row_id,
        'attachments', attachments,
        'invoiceDocs', (select coalesce(jsonb_agg(a), '[]'::jsonb) from jsonb_array_elements(attachments) a where public.raiz_doc_kind_from_text(a->>'kind') in ('NF', 'FATURA', 'RECIBO')),
        'chargeDocs', (select coalesce(jsonb_agg(a), '[]'::jsonb) from jsonb_array_elements(attachments) a where public.raiz_doc_kind_from_text(a->>'kind') = 'BOLETO'),
        'proofDocs', (select coalesce(jsonb_agg(a), '[]'::jsonb) from jsonb_array_elements(attachments) a where public.raiz_doc_kind_from_text(a->>'kind') = 'COMPROVANTE'),
        'fiscalDocs', (select coalesce(jsonb_agg(a), '[]'::jsonb) from jsonb_array_elements(attachments) a where public.raiz_doc_kind_from_text(a->>'kind') in ('NF', 'FATURA', 'RECIBO'))
      ) order by tr_num)
      from recent_grouped
    ), '[]'::jsonb)
  )
);
$$;
