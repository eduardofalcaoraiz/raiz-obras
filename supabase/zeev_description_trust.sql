alter table public.capex_zeev_solicitacoes
  add column if not exists descricao_confiavel boolean
  generated always as (
    nullif(btrim(pedido), '') is not null
    and coalesce(campos_extraidos ->> '_descricao_status', '') = 'completa'
    and coalesce(campos_extraidos ->> '_descricao_regra', '') in (
      'informacoes_referentes_solicitacao_v2',
      'informacoes_referentes_solicitacao_v3',
      'informacoes_referentes_solicitacao_v4',
      'informacoes_referentes_solicitacao_v5'
    )
  ) stored;

drop index if exists public.idx_capex_zeev_pending_description_repair;

create index idx_capex_zeev_pending_description_repair
  on public.capex_zeev_solicitacoes (start_date_time desc, id desc)
  where status = 'pendente' and setor = 'FINANCEIRO' and descricao_confiavel = false;
