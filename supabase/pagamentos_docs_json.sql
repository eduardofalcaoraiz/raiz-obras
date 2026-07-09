alter table public.pagamentos
  add column if not exists docs_json jsonb not null default '[]'::jsonb;

comment on column public.pagamentos.docs_json is
  'Lista de documentos/anexos do pagamento. Mantem compatibilidade com nf_doc_path e comp_doc_path.';
