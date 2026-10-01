begin;
create or replace function public.real_estate_pending_owner() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.user_profiles where id=auth.uid() and id='e56ab877-62a8-4f2c-9ef8-55ab93fd51b9'::uuid and aprovado and role='admin');
$$;
revoke all on function public.real_estate_pending_owner() from public,anon;
grant execute on function public.real_estate_pending_owner() to authenticated;
create table if not exists public.real_estate_pending (
 id bigint generated always as identity primary key,
 ticket_raiz text not null check(ticket_raiz ~ '^[0-9]{4,8}$'),
 source_fingerprint text not null,
 snapshot jsonb not null,
 evidence jsonb not null,
 previous_snapshot jsonb,
 status text not null default 'pending' check(status in ('pending','approved','ignored','superseded')),
 discovered_at timestamptz not null default now(),
 decided_at timestamptz, decided_by uuid, decision_reason text, decision jsonb,
 unique(ticket_raiz,source_fingerprint)
);
create index if not exists real_estate_pending_status_idx on public.real_estate_pending(status,discovered_at desc);
alter table public.real_estate_pending add column if not exists revision integer not null default 1;
create table if not exists public.real_estate_sync_state (
 name text primary key, value jsonb not null, updated_at timestamptz not null default now()
);
create table if not exists public.real_estate_sync_runs (
 id uuid primary key default gen_random_uuid(), started_at timestamptz not null default now(),
 finished_at timestamptz, status text not null default 'running', summary jsonb not null default '{}'
);
alter table public.real_estate_pending enable row level security;
alter table public.real_estate_sync_state enable row level security;
alter table public.real_estate_sync_runs enable row level security;
revoke all on public.real_estate_pending,public.real_estate_sync_state,public.real_estate_sync_runs from anon,authenticated;
grant select on public.real_estate_pending,public.real_estate_sync_runs to authenticated;
grant all on public.real_estate_pending,public.real_estate_sync_state,public.real_estate_sync_runs to service_role;
grant usage,select on sequence public.real_estate_pending_id_seq to service_role;
drop policy if exists real_estate_pending_read on public.real_estate_pending;
create policy real_estate_pending_read on public.real_estate_pending for select to authenticated using(public.real_estate_pending_owner());
drop policy if exists real_estate_sync_runs_read on public.real_estate_sync_runs;
create policy real_estate_sync_runs_read on public.real_estate_sync_runs for select to authenticated using(public.real_estate_pending_owner());
create or replace function public.ingest_real_estate_pending(p_candidate jsonb) returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id bigint; v_ticket text:=p_candidate->>'ticket_raiz'; v_previous jsonb;
begin
 if v_ticket !~ '^[0-9]{4,8}$' or p_candidate->'snapshot'->>'ticket_raiz' is distinct from v_ticket then raise exception 'Invalid candidate'; end if;
 perform pg_advisory_xact_lock(hashtextextended('real-estate:'||v_ticket,0));
 select id into v_id from public.real_estate_pending where ticket_raiz=v_ticket and source_fingerprint=p_candidate->>'source_fingerprint';
 if found then
   select to_jsonb(t) into v_previous from public.real_estate_tickets t where t.ticket_raiz=v_ticket;
   update public.real_estate_pending set evidence=p_candidate-'snapshot'-'source_fingerprint',previous_snapshot=v_previous,revision=revision+1 where id=v_id and status='pending' and (previous_snapshot is distinct from v_previous or evidence is distinct from p_candidate-'snapshot'-'source_fingerprint');
   return v_id;
 end if;
 select to_jsonb(t) into v_previous from public.real_estate_tickets t where ticket_raiz=v_ticket;
 update public.real_estate_pending set status='superseded' where ticket_raiz=v_ticket and status='pending';
 insert into public.real_estate_pending(ticket_raiz,source_fingerprint,snapshot,evidence,previous_snapshot)
 values(v_ticket,p_candidate->>'source_fingerprint',p_candidate->'snapshot',p_candidate-'snapshot'-'source_fingerprint',v_previous) returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.ingest_real_estate_pending(jsonb) from public,anon,authenticated;
grant execute on function public.ingest_real_estate_pending(jsonb) to service_role;
drop function if exists public.decide_real_estate_pending(bigint,text,boolean,text,uuid,text,text);
create or replace function public.decide_real_estate_pending(p_id bigint,p_fingerprint text,p_approve boolean,p_kind text,p_target uuid,p_type text,p_reason text,p_revision integer) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.real_estate_pending; v_current jsonb; s public.real_estate_tickets; v_imoveis uuid[]; v_subs uuid[];
begin
 if not public.real_estate_pending_owner() then raise exception 'Somente o administrador responsavel pode aprovar'; end if;
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'Informe o motivo da decisao'; end if;
 select * into q from public.real_estate_pending where id=p_id for update;
 if not found or q.status<>'pending' or q.source_fingerprint is distinct from p_fingerprint or q.revision is distinct from p_revision then raise exception 'Registro alterado ou ja analisado. Atualize a fila.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('real-estate:'||q.ticket_raiz,0));
 if p_approve then
   if p_kind not in ('imovel','sublocacao') or p_target is null then raise exception 'Selecione o destino'; end if;
   if p_kind='imovel' and not exists(select 1 from public.real_estate_imoveis where id=p_target) then raise exception 'Imovel inexistente'; end if;
   if p_kind='sublocacao' and not exists(select 1 from public.real_estate_sublocacoes where id=p_target) then raise exception 'Sublocacao inexistente'; end if;
   if nullif(trim(p_type),'') is null then raise exception 'Informe o tipo de lancamento'; end if;
   select to_jsonb(t) into v_current from public.real_estate_tickets t where ticket_raiz=q.ticket_raiz for update;
   if v_current is distinct from q.previous_snapshot then raise exception 'O historico deste TR mudou depois da coleta. Aguarde nova conferencia antes de aprovar.'; end if;
   s:=jsonb_populate_record(null::public.real_estate_tickets,q.snapshot);
   if s.valor_total is null or s.valor_total<0 then raise exception 'Valor ausente ou invalido. Corrija/conclua o TR no Zeev e aguarde nova coleta.'; end if;
   select coalesce(array_agg(distinct v),'{}') into v_imoveis from (select jsonb_array_elements_text(coalesce(v_current->'imovel_ids','[]'))::uuid v union all select p_target where p_kind='imovel') a;
   select coalesce(array_agg(distinct v),'{}') into v_subs from (select jsonb_array_elements_text(coalesce(v_current->'sublocacao_ids','[]'))::uuid v union all select p_target where p_kind='sublocacao') a;
   insert into public.real_estate_tickets(ticket_raiz,imovel_ids,sublocacao_ids,descricao,fornecedor,cnpj_fornecedor,centro_custo,valor_total,vencimento,competencia,status,etapa,financeiro,ticket_url,anexos,componentes,vinculo_revisar,observacoes,sincronizado_em)
   values(q.ticket_raiz,v_imoveis,v_subs,coalesce(s.descricao,''),coalesce(s.fornecedor,''),coalesce(s.cnpj_fornecedor,''),coalesce(s.centro_custo,''),s.valor_total,s.vencimento,coalesce(s.competencia,''),coalesce(s.status,'Nao confirmado'),coalesce(s.etapa,''),coalesce(s.financeiro,false),s.ticket_url,coalesce(s.anexos,'[]'),coalesce(s.componentes,'[]'),false,'Classificacao aprovada: '||p_type||'. '||coalesce(s.observacoes,''),now())
   on conflict(ticket_raiz) do update set imovel_ids=excluded.imovel_ids,sublocacao_ids=excluded.sublocacao_ids,descricao=excluded.descricao,fornecedor=excluded.fornecedor,cnpj_fornecedor=excluded.cnpj_fornecedor,centro_custo=excluded.centro_custo,valor_total=excluded.valor_total,vencimento=excluded.vencimento,competencia=excluded.competencia,status=excluded.status,etapa=excluded.etapa,financeiro=excluded.financeiro,
   anexos=(select coalesce(jsonb_agg(distinct x),'[]') from jsonb_array_elements(public.real_estate_tickets.anexos||excluded.anexos) x),componentes=excluded.componentes,vinculo_revisar=false,observacoes=public.real_estate_tickets.observacoes||E'\n'||excluded.observacoes,sincronizado_em=now();
 end if;
 update public.real_estate_pending set status=case when p_approve then 'approved' else 'ignored' end,decided_at=now(),decided_by=auth.uid(),decision_reason=trim(p_reason),decision=jsonb_build_object('kind',p_kind,'target',p_target,'type',p_type) where id=p_id;
 return jsonb_build_object('ok',true,'ticket',q.ticket_raiz);
end;
$$;
revoke all on function public.decide_real_estate_pending(bigint,text,boolean,text,uuid,text,text,integer) from public,anon;
grant execute on function public.decide_real_estate_pending(bigint,text,boolean,text,uuid,text,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
