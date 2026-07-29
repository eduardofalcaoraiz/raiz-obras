alter table public.pagamentos
  add column if not exists compra_vinculada_json jsonb;

create index if not exists pagamentos_compra_vinculada_tr_idx
  on public.pagamentos ((compra_vinculada_json->>'tr'))
  where compra_vinculada_json is not null;

comment on column public.pagamentos.compra_vinculada_json is
  'Dados estruturados do vinculo entre um pagamento de obra e a solicitacao de compra do Ticket Raiz.';
