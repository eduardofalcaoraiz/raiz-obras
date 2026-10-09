begin;
-- Registered snapshots only; ambiguous legacy/manual financial changes require review.
create or replace function public.refresh_real_estate_snapshot(p_candidate jsonb)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_ticket text:=p_candidate->>'ticket_raiz';
 v_id bigint;
 v_snapshot jsonb:=p_candidate->'snapshot';
 v_current jsonb; v_baseline jsonb; v_fields jsonb; v_old_fields jsonb;
 v_keys text[]:=array['descricao','fornecedor','cnpj_fornecedor','centro_custo','valor_total','vencimento','competencia','financeiro','componentes'];
 v_conflict boolean;
begin
 if v_ticket is null or v_ticket !~ '^[0-9]{4,8}$'
    or v_snapshot->>'ticket_raiz' is distinct from v_ticket
    or jsonb_typeof(v_snapshot->'anexos') is distinct from 'array'
    or v_snapshot->>'status' is null or v_snapshot->>'etapa' is null then
   raise exception 'Invalid snapshot refresh';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('real-estate:'||v_ticket,0));
 select to_jsonb(t) into v_current from public.real_estate_tickets t where ticket_raiz=v_ticket for update;
 if not found then raise exception 'Snapshot refresh requires a registered ticket'; end if;
 select jsonb_object_agg(k,v_snapshot->k),jsonb_object_agg(k,v_current->k)
 into v_fields,v_old_fields from unnest(v_keys) k;
 select value into v_baseline from public.real_estate_sync_state where name='snapshot-source:'||v_ticket;
 -- Never infer ownership from a differing legacy value. A matching observation
 -- establishes the source baseline; later local edits break that equality.
 v_conflict:=coalesce((v_current->>'vinculo_revisar')::boolean,true)
   or jsonb_array_length(v_current->'imovel_ids')+jsonb_array_length(v_current->'sublocacao_ids')<>1
   or exists(select 1 from public.real_estate_lancamentos l where l.ticket_raiz=v_ticket
     and l.valor is not null and (v_snapshot->>'valor_total' is null
       or abs(l.valor-(v_snapshot->>'valor_total')::numeric)>0.01));
 if not v_conflict and (v_baseline=v_old_fields or (v_baseline is null and v_old_fields=v_fields))
    and v_snapshot->>'valor_total' is not null and (v_snapshot->>'valor_total')::numeric>=0
    and not exists(select 1 from unnest(v_keys) k where not (v_snapshot ? k))
    and not exists(select 1 from unnest(array['descricao','fornecedor','cnpj_fornecedor','centro_custo']) k
      where nullif(v_current->>k,'') is not null and nullif(v_snapshot->>k,'') is null)
    and jsonb_typeof(v_snapshot->'componentes')='array'
    and (jsonb_array_length(v_snapshot->'componentes')>0 or jsonb_array_length(v_current->'componentes')=0)
    and (v_snapshot->>'vencimento' is not null or v_current->>'vencimento' is null)
    and (nullif(v_snapshot->>'competencia','') is not null or nullif(v_current->>'competencia','') is null)
    and (jsonb_array_length(v_snapshot->'componentes')=0 or
      (select sum((c->>'valor')::numeric) from jsonb_array_elements(v_snapshot->'componentes') c)=(v_snapshot->>'valor_total')::numeric) then
   update public.real_estate_tickets set
     descricao=v_snapshot->>'descricao',fornecedor=v_snapshot->>'fornecedor',
     cnpj_fornecedor=v_snapshot->>'cnpj_fornecedor',centro_custo=v_snapshot->>'centro_custo',
     valor_total=(v_snapshot->>'valor_total')::numeric,vencimento=(v_snapshot->>'vencimento')::date,
     competencia=v_snapshot->>'competencia',financeiro=(v_snapshot->>'financeiro')::boolean,
     componentes=v_snapshot->'componentes'
   where ticket_raiz=v_ticket;
   insert into public.real_estate_sync_state(name,value,updated_at)
   values('snapshot-source:'||v_ticket,v_fields,now())
   on conflict(name) do update set value=excluded.value,updated_at=excluded.updated_at;
 end if;
 -- Destinations, ledger allocations, notes and manual classifications are untouched.
 update public.real_estate_tickets t set
   status=v_snapshot->>'status', etapa=v_snapshot->>'etapa',
   ticket_url=case when v_snapshot->>'ticket_url' ~ '^https://raizeducacao[.]zeev[.]it/[^[:space:][:cntrl:]]*$'
     then v_snapshot->>'ticket_url' else t.ticket_url end,
   anexos=(select coalesce(jsonb_agg(a),'[]'::jsonb) from (
     select a from jsonb_array_elements(t.anexos) a
       where not exists(select 1 from jsonb_array_elements(v_snapshot->'anexos') b
         where a->>'nome'=b->>'nome' and coalesce(a->>'campo','')=coalesce(b->>'campo',''))
     union
     select a from jsonb_array_elements(v_snapshot->'anexos') a
   ) merged),
   sincronizado_em=now()
 where t.ticket_raiz=v_ticket;
 -- Capture the post-refresh previous_snapshot so review's concurrency guard holds.
 v_id:=public.ingest_real_estate_pending(p_candidate);
 return v_id;
end;
$$;
revoke all on function public.refresh_real_estate_snapshot(jsonb) from public,anon,authenticated;
grant execute on function public.refresh_real_estate_snapshot(jsonb) to service_role;
notify pgrst,'reload schema';
commit;
