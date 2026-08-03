create index if not exists pagamentos_ticket_raiz_idx
  on public.pagamentos (ticket_raiz)
  where ticket_raiz is not null;

create index if not exists pagamentos_obra_scope_status_idx
  on public.pagamentos (obra_id, escopo_fin, st)
  where obra_id is not null;

create index if not exists pagamentos_docs_checked_idx
  on public.pagamentos (zeev_docs_checked_at)
  where ticket_raiz is not null;

create index if not exists capex_itens_ticket_raiz_instance_id_idx
  on public.capex_itens (ticket_raiz_instance_id)
  where ticket_raiz_instance_id is not null;

create index if not exists capex_itens_referencia_idx
  on public.capex_itens (referencia)
  where referencia is not null;

create index if not exists capex_itens_dashboard_idx
  on public.capex_itens (ano, marca, unidade);

create index if not exists capex_itens_docs_checked_idx
  on public.capex_itens (zeev_docs_checked_at)
  where ticket_raiz_instance_id is not null or referencia is not null;

create index if not exists capex_zeev_docs_checked_idx
  on public.capex_zeev_solicitacoes (zeev_docs_checked_at)
  where zeev_instance_id is not null;
