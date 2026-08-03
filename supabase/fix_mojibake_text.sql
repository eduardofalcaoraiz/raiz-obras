create or replace function public.raiz_try_fix_mojibake_text(value text)
returns text
language plpgsql
immutable
as $$
declare
  fixed text;
begin
  if value is null or value !~ '(Ã|Â|â|ï¼)' then
    return value;
  end if;

  begin
    fixed := convert_from(convert_to(value, 'LATIN1'), 'UTF8');
    if fixed is null or fixed = '' or fixed ~ '�' then
      return value;
    end if;
    return fixed;
  exception when others then
    return value;
  end;
end;
$$;

create or replace function public.raiz_fix_mojibake_jsonb(value jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb;
begin
  if value is null then
    return value;
  end if;

  case jsonb_typeof(value)
    when 'string' then
      return to_jsonb(public.raiz_try_fix_mojibake_text(value #>> '{}'));
    when 'array' then
      select coalesce(jsonb_agg(public.raiz_fix_mojibake_jsonb(elem.value) order by elem.ordinality), '[]'::jsonb)
        into result
      from jsonb_array_elements(value) with ordinality elem(value, ordinality);
      return result;
    when 'object' then
      select coalesce(jsonb_object_agg(obj.key, public.raiz_fix_mojibake_jsonb(obj.value)), '{}'::jsonb)
        into result
      from jsonb_each(value) obj(key, value);
      return result;
    else
      return value;
  end case;
end;
$$;

with fixed as (
  update public.capex_itens
     set unidade = public.raiz_try_fix_mojibake_text(unidade),
         fonte = public.raiz_try_fix_mojibake_text(fonte),
         pedido = public.raiz_try_fix_mojibake_text(pedido),
         referencia = public.raiz_try_fix_mojibake_text(referencia),
         setor = public.raiz_try_fix_mojibake_text(setor),
         situacao = public.raiz_try_fix_mojibake_text(situacao),
         observacoes = public.raiz_try_fix_mojibake_text(observacoes),
         marca = public.raiz_try_fix_mojibake_text(marca),
         categoria_capex = public.raiz_try_fix_mojibake_text(categoria_capex),
         ticket_raiz_dados = public.raiz_fix_mojibake_jsonb(ticket_raiz_dados),
         unidades_json = public.raiz_fix_mojibake_jsonb(unidades_json),
         docs_json = public.raiz_fix_mojibake_jsonb(docs_json),
         updated_at = coalesce(updated_at, now())
   where coalesce(unidade, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(fonte, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(pedido, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(referencia, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(setor, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(situacao, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(observacoes, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(marca, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(categoria_capex, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(ticket_raiz_dados::text, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(unidades_json::text, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(docs_json::text, '') ~ '(Ã|Â|â|ï¼)'
  returning id
),
fixed_pending as (
  update public.capex_zeev_solicitacoes
     set pedido = public.raiz_try_fix_mojibake_text(pedido),
         request_name = public.raiz_try_fix_mojibake_text(request_name),
         flow_name = public.raiz_try_fix_mojibake_text(flow_name),
         requester_name = public.raiz_try_fix_mojibake_text(requester_name),
         requester_team = public.raiz_try_fix_mojibake_text(requester_team),
         etapa_atual = public.raiz_try_fix_mojibake_text(etapa_atual),
         unidade = public.raiz_try_fix_mojibake_text(unidade),
         marca = public.raiz_try_fix_mojibake_text(marca),
         categoria_capex = public.raiz_try_fix_mojibake_text(categoria_capex),
         fonte = public.raiz_try_fix_mojibake_text(fonte),
         setor = public.raiz_try_fix_mojibake_text(setor),
         situacao_sugerida = public.raiz_try_fix_mojibake_text(situacao_sugerida),
         campos_extraidos = public.raiz_fix_mojibake_jsonb(campos_extraidos),
         raw_fields = public.raiz_fix_mojibake_jsonb(raw_fields),
         raw_instance = public.raiz_fix_mojibake_jsonb(raw_instance),
         raw_tasks = public.raiz_fix_mojibake_jsonb(raw_tasks),
         itens_json = public.raiz_fix_mojibake_jsonb(itens_json),
         pagamento_json = public.raiz_fix_mojibake_jsonb(pagamento_json),
         docs_json = public.raiz_fix_mojibake_jsonb(docs_json)
   where coalesce(pedido, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(request_name, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(flow_name, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(requester_name, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(requester_team, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(etapa_atual, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(unidade, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(marca, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(categoria_capex, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(fonte, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(setor, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(situacao_sugerida, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(campos_extraidos::text, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(raw_fields::text, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(raw_instance::text, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(raw_tasks::text, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(itens_json::text, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(pagamento_json::text, '') ~ '(Ã|Â|â|ï¼)'
      or coalesce(docs_json::text, '') ~ '(Ã|Â|â|ï¼)'
  returning id
)
select
  (select count(*) from fixed) as capex_itens_corrigidos,
  (select count(*) from fixed_pending) as registros_zeev_corrigidos;
