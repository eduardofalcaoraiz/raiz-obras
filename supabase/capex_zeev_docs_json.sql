alter table public.capex_zeev_solicitacoes
  add column if not exists docs_json jsonb not null default '[]'::jsonb,
  add column if not exists zeev_docs_checked_at timestamptz;

comment on column public.capex_zeev_solicitacoes.docs_json is
  'Anexos do Ticket Raiz importados antes da aprovacao, para consulta nos registros pendentes.';

comment on column public.capex_zeev_solicitacoes.zeev_docs_checked_at is
  'Ultima varredura para anexos, comprovantes e informacoes de pagamento do Ticket Raiz.';
