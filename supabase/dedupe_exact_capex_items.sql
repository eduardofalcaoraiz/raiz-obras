with duplicate_groups as (
  select
    min(id) as keep_id,
    array_remove(array_agg(id order by id), min(id)) as delete_ids
  from capex_itens
  where coalesce(ticket_raiz_instance_id::text, referencia, '') <> ''
  group by
    coalesce(ticket_raiz_instance_id::text, referencia, ''),
    ano,
    coalesce(unidade, ''),
    coalesce(marca, ''),
    round(coalesce(orcamento, 0)::numeric, 2),
    coalesce(categoria_capex, ''),
    coalesce(situacao, ''),
    lower(regexp_replace(coalesce(pedido, ''), '\s+', ' ', 'g'))
  having count(*) > 1
),
deleted as (
  delete from capex_itens i
  using duplicate_groups g
  where i.id = any(g.delete_ids)
  returning i.id, i.ticket_raiz_instance_id, i.referencia, i.ano, i.unidade, i.marca, i.orcamento, i.situacao
)
select
  count(*) as deleted_exact_duplicates,
  coalesce(jsonb_agg(to_jsonb(deleted) order by id), '[]'::jsonb) as rows
from deleted;
