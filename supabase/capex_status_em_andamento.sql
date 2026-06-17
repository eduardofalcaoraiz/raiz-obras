update public.capex_itens
set situacao = 'Em Andamento'
where coalesce(nullif(trim(situacao), ''), 'Pendente') in ('Pendente', '-');
