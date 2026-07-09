alter table public.capex_itens
  add column if not exists docs_json jsonb not null default '[]'::jsonb;

comment on column public.capex_itens.docs_json is
  'Lista de documentos/anexos importados do Ticket Raiz para pedidos CAPEX registrados.';
