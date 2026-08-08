begin;

-- The 2025 source sheet is a planning backlog and has no Ticket column.
update public.capex_itens
set origem = 'PLANEJAMENTO_HISTORICO',
    updated_at = now()
where ano = 2025
  and lower(coalesce(situacao, '')) = 'em andamento'
  and ticket_raiz_instance_id is null
  and created_at = timestamptz '2026-07-22 15:30:14.278822+00'
  and coalesce(origem, '') <> 'PLANEJAMENTO_HISTORICO';

-- The 2026 sheet has a dedicated Ticket column that was imported into referencia.
update public.capex_itens
set ticket_raiz_instance_id = trim(referencia)::bigint,
    origem = 'IMPORTACAO_PLANILHA_COM_TR',
    updated_at = now()
where ano = 2026
  and lower(coalesce(situacao, '')) = 'em andamento'
  and ticket_raiz_instance_id is null
  and created_at = timestamptz '2026-07-22 15:30:14.278822+00'
  and trim(coalesce(referencia, '')) ~ '^\d{3,9}$';

commit;
