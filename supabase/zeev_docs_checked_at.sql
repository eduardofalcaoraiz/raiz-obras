alter table public.pagamentos
  add column if not exists zeev_docs_checked_at timestamptz;

alter table public.capex_itens
  add column if not exists zeev_docs_checked_at timestamptz;

comment on column public.pagamentos.zeev_docs_checked_at is
  'Ultima varredura Zeev para anexos, comprovantes e data real de pagamento.';

comment on column public.capex_itens.zeev_docs_checked_at is
  'Ultima varredura Zeev para anexos e status do Ticket Raiz registrado como CAPEX.';
