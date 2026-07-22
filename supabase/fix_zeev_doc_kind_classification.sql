-- Reclassifica anexos Zeev salvos com rótulo antigo incorreto.
-- Não apaga arquivos do Storage; apenas corrige kind em docs_json e remove
-- boleto/comprovante do campo legado nf_doc_path.

create or replace function public.raiz_zeev_doc_kind_from_json(doc jsonb)
returns text
language sql
immutable
as $$
  select case
    when lower(
      coalesce(doc->>'source','') || ' ' ||
      coalesce(doc->>'field','') || ' ' ||
      coalesce(doc->>'fieldName','') || ' ' ||
      coalesce(doc->>'label','')
    ) ~ '(comprovante|comprovantedopagamento|arquivocomprovante|documentocomprovante|pix)'
      then 'COMPROVANTE'
    when lower(
      coalesce(doc->>'source','') || ' ' ||
      coalesce(doc->>'field','') || ' ' ||
      coalesce(doc->>'fieldName','') || ' ' ||
      coalesce(doc->>'label','')
    ) ~ '(anexarboleto|boletoparcelado|boletoavista|boleto)'
      then 'BOLETO'
    when lower(coalesce(doc->>'source','')) ~ 'fatura'
      then 'FATURA'
    when lower(coalesce(doc->>'source','')) ~ 'recibo'
      then 'RECIBO'
    when lower(
      coalesce(doc->>'name','') || ' ' ||
      coalesce(doc->>'url','') || ' ' ||
      coalesce(doc->>'storagePath','') || ' ' ||
      coalesce(doc->>'path','')
    ) ~ '(comprovante|pix|liquidado|liquidacao|pago)'
      then 'COMPROVANTE'
    when lower(
      coalesce(doc->>'name','') || ' ' ||
      coalesce(doc->>'url','') || ' ' ||
      coalesce(doc->>'storagePath','') || ' ' ||
      coalesce(doc->>'path','')
    ) ~ '(boleto|boletoparcelado|boletoavista)'
      then 'BOLETO'
    when lower(
      coalesce(doc->>'name','') || ' ' ||
      coalesce(doc->>'url','') || ' ' ||
      coalesce(doc->>'storagePath','') || ' ' ||
      coalesce(doc->>'path','')
    ) ~ '(fatura|(^|[^a-z])ft[ _-]*0*[0-9]{2,})'
      then 'FATURA'
    when lower(
      coalesce(doc->>'name','') || ' ' ||
      coalesce(doc->>'url','') || ' ' ||
      coalesce(doc->>'storagePath','') || ' ' ||
      coalesce(doc->>'path','')
    ) ~ 'recibo'
      then 'RECIBO'
    else upper(coalesce(nullif(doc->>'kind',''), 'DOCUMENTO'))
  end
$$;

create or replace function public.raiz_reclassify_zeev_docs_json(input jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(
      case
        when value ? 'kind' then jsonb_set(value, '{kind}', to_jsonb(public.raiz_zeev_doc_kind_from_json(value)))
        else value || jsonb_build_object('kind', public.raiz_zeev_doc_kind_from_json(value))
      end
      order by ord
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(coalesce(input, '[]'::jsonb)) with ordinality as items(value, ord)
$$;

update public.pagamentos
set docs_json = public.raiz_reclassify_zeev_docs_json(docs_json)
where docs_json is not null
  and docs_json <> '[]'::jsonb;

update public.capex_zeev_solicitacoes
set docs_json = public.raiz_reclassify_zeev_docs_json(docs_json)
where docs_json is not null
  and docs_json <> '[]'::jsonb;

update public.capex_itens
set docs_json = public.raiz_reclassify_zeev_docs_json(docs_json)
where docs_json is not null
  and docs_json <> '[]'::jsonb;

update public.pagamentos
set
  comp_doc_path = case
    when (comp_doc_path is null or comp_doc_path = '')
      and lower(coalesce(nf_doc_path,'')) ~ '(comprovante|pix)'
      then nf_doc_path
    else comp_doc_path
  end,
  nf_doc_path = ''
where nf_doc_path is not null
  and nf_doc_path <> ''
  and lower(nf_doc_path) ~ '(boleto|comprovante|pix)';
