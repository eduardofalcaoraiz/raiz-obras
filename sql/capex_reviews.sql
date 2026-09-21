-- Non-destructive CAPEX reclassification. Apply in a transaction.
create table if not exists public.capex_reviews (
  id bigint generated always as identity primary key,
  item_id integer not null references public.capex_itens(id) on delete restrict,
  requested_by uuid not null,
  requester_name text not null,
  requester_email text not null,
  reason text not null check (length(btrim(reason)) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  request_snapshot jsonb not null,
  decided_by uuid,
  decided_at timestamptz,
  decision_reason text,
  decision_snapshot jsonb,
  constraint capex_review_decision_complete check (
    (status='pending' and decided_by is null and decided_at is null and decision_reason is null and decision_snapshot is null)
    or (status<>'pending' and decided_by is not null and decided_at is not null
      and decision_reason is not null and length(btrim(decision_reason)) between 3 and 2000 and decision_snapshot is not null))
);
create unique index if not exists capex_reviews_one_pending on public.capex_reviews(item_id) where status='pending';
create unique index if not exists capex_reviews_one_approval on public.capex_reviews(item_id) where status='approved';
create index if not exists capex_reviews_status_date on public.capex_reviews(status,requested_at desc,id desc);
alter table public.capex_reviews enable row level security;
revoke all on public.capex_reviews from public,anon,authenticated;
grant select on public.capex_reviews to authenticated;
grant all on public.capex_reviews to service_role;

create or replace function public.capex_review_is_owner() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.user_profiles where id=auth.uid()
    and id='e56ab877-62a8-4f2c-9ef8-55ab93fd51b9'::uuid and aprovado and role='admin');
$$;
create or replace function public.capex_review_excluded(p_item_id integer) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.capex_reviews where item_id=p_item_id and status='approved');
$$;
create or replace function public.capex_review_snapshot(p public.capex_itens) returns jsonb
language sql immutable set search_path=public,pg_temp as $$
  select jsonb_build_object('id',p.id,'ano',p.ano,'marca',p.marca,'unidade',p.unidade,
    'unidades_json',p.unidades_json,'pedido',p.pedido,'referencia',p.referencia,
    'orcamento',p.orcamento,'situacao',p.situacao,'realizado',p.realizado,
    'aprovado',p.aprovado,'categoria_capex',p.categoria_capex,'origem',p.origem,'docs_json',p.docs_json,
    'observacoes',p.observacoes,'ticket_raiz_url',p.ticket_raiz_url,
    'ticket_raiz_instance_id',p.ticket_raiz_instance_id,'fonte',p.fonte,'setor',p.setor,
    'ticket_raiz_dados',coalesce(p.ticket_raiz_dados,'{}'::jsonb)-'raw_instance'-'raw_fields'-'raw_tasks');
$$;
drop policy if exists review_read on public.capex_reviews;
create policy review_read on public.capex_reviews for select to authenticated using (
  public.capex_review_is_owner() or (public.app_can('capex')
    and (public.app_can('registros') or requested_by=auth.uid())));

-- Archived rows remain in the database for documents, reconciliation and sync.
drop policy if exists access_read on public.capex_itens;
create policy access_read on public.capex_itens for select to authenticated using (
  public.app_can('capex') and not public.capex_review_excluded(id));
drop policy if exists access_update on public.capex_itens;
create policy access_update on public.capex_itens for update to authenticated using (
  public.app_can('capex','edit') and not public.capex_review_excluded(id)) with check (
  public.app_can('capex','edit') and not public.capex_review_excluded(id));
-- Editors request review instead of deleting. Existing owner deletion is retained
-- for records without review history; the foreign key protects reviewed records.
drop policy if exists access_delete on public.capex_itens;
create policy access_delete on public.capex_itens for delete to authenticated using (public.capex_review_is_owner());

create or replace function public.request_capex_review(p_item_id integer,p_reason text) returns public.capex_reviews
language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.capex_itens; result public.capex_reviews; person public.user_profiles;
begin
  if not public.app_can('capex') then raise exception 'Acesso ao CAPEX necessario.' using errcode='42501'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 10 and 2000 then
    raise exception 'Informe um motivo entre 10 e 2000 caracteres.' using errcode='22023'; end if;
  select * into item from public.capex_itens where id=p_item_id for update;
  if not found or public.capex_review_excluded(p_item_id) then raise exception 'Gasto indisponivel ou ja excluido do CAPEX.'; end if;
  select * into result from public.capex_reviews where item_id=p_item_id and status='pending';
  if found then raise exception 'Este gasto ja tem uma revisao pendente.' using errcode='23505'; end if;
  select * into person from public.user_profiles where id=auth.uid();
  insert into public.capex_reviews(item_id,requested_by,requester_name,requester_email,reason,request_snapshot)
    values(p_item_id,auth.uid(),coalesce(person.nome,person.email),person.email,btrim(p_reason),public.capex_review_snapshot(item)) returning * into result;
  return result;
end;
$$;

create or replace function public.get_capex_review(p_review_id bigint) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.capex_reviews; item public.capex_itens; snap jsonb;
begin
  select * into r from public.capex_reviews where id=p_review_id;
  if not found or not (public.capex_review_is_owner() or (public.app_can('capex')
    and (public.app_can('registros') or r.requested_by=auth.uid()))) then
    raise exception 'Revisao indisponivel.' using errcode='42501'; end if;
  select * into item from public.capex_itens where id=r.item_id;
  snap:=public.capex_review_snapshot(item);
  return jsonb_build_object('review',to_jsonb(r),'current_item',snap,'version',md5(snap::text));
end;
$$;

create or replace function public.decide_capex_review(p_review_id bigint,p_approve boolean,p_reason text,p_version text)
returns public.capex_reviews language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.capex_reviews; item public.capex_itens; item_id integer; snap jsonb;
begin
  if not public.capex_review_is_owner() then raise exception 'Somente Eduardo pode julgar esta revisao.' using errcode='42501'; end if;
  if p_approve is null or p_reason is null or length(btrim(p_reason)) not between 3 and 2000 then
    raise exception 'Informe a justificativa da decisao (3 a 2000 caracteres).' using errcode='22023'; end if;
  select x.item_id into item_id from public.capex_reviews x where x.id=p_review_id;
  if not found then raise exception 'Revisao nao encontrada.'; end if;
  select * into item from public.capex_itens where id=item_id for update;
  if not found then raise exception 'Gasto nao encontrado.'; end if;
  select * into r from public.capex_reviews where id=p_review_id for update;
  if r.status<>'pending' then raise exception 'Esta revisao ja foi julgada. Atualize a fila.' using errcode='40001'; end if;
  snap:=public.capex_review_snapshot(item);
  if p_version is distinct from md5(snap::text) then
    raise exception 'O gasto mudou desde a abertura. Reabra e confira os valores antes de decidir.' using errcode='40001'; end if;
  update public.capex_reviews set status=case when p_approve then 'approved' else 'rejected' end,
    decided_by=auth.uid(),decided_at=now(),decision_reason=btrim(p_reason),decision_snapshot=snap
    where id=p_review_id returning * into r;
  if p_approve then
    update public.capex_zeev_solicitacoes set status='ignorado',ignorado_por='Revisao CAPEX #'||r.id,
      ignorado_em=now() where capex_item_id=item.id;
  end if;
  return r;
end;
$$;

-- A later Zeev refresh must not put an approved exclusion back in the queue.
create or replace function public.guard_capex_review_queue() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare excluded_id integer;
begin
  -- Keep the exclusion linked even when an upsert clears or replaces the FK.
  if tg_op='UPDATE' and public.capex_review_excluded(old.capex_item_id) then
    excluded_id:=old.capex_item_id;
  elsif public.capex_review_excluded(new.capex_item_id) then
    excluded_id:=new.capex_item_id;
  else
    select r.item_id into excluded_id from public.capex_reviews r
      where r.status='approved'
        and (r.decision_snapshot->>'ticket_raiz_instance_id'=new.zeev_instance_id::text
          or r.decision_snapshot->>'referencia'=new.zeev_instance_id::text)
      order by r.id limit 1;
  end if;
  if excluded_id is not null then
    new.capex_item_id:=excluded_id;
    new.status:='ignorado';
    new.ignorado_por:=case when tg_op='UPDATE' then coalesce(old.ignorado_por,'Revisao CAPEX aprovada') else 'Revisao CAPEX aprovada' end;
    new.ignorado_em:=case when tg_op='UPDATE' then coalesce(old.ignorado_em,now()) else now() end;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_capex_review_queue on public.capex_zeev_solicitacoes;
create trigger guard_capex_review_queue before insert or update on public.capex_zeev_solicitacoes
  for each row execute function public.guard_capex_review_queue();

do $$ declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('capex_review_is_owner','capex_review_excluded','capex_review_snapshot',
      'request_capex_review','get_capex_review','decide_capex_review','guard_capex_review_queue')
  loop execute format('revoke all on function %s from public,anon,authenticated',f);
       execute format('grant execute on function %s to service_role',f); end loop;
end $$;
grant execute on function public.capex_review_is_owner(),public.capex_review_excluded(integer),
  public.request_capex_review(integer,text),public.get_capex_review(bigint),
  public.decide_capex_review(bigint,boolean,text,text) to authenticated;
notify pgrst,'reload schema';
