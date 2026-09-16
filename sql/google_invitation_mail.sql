-- No authentication links or Google tokens are persisted in the queue.
create table if not exists public.user_access_mail_queue (
  id uuid primary key,
  invitation_id uuid unique references public.user_access_invitations(id),
  actor uuid not null,
  recipient text not null,
  is_test boolean not null default false,
  state text not null default 'queued' check(state in ('queued','processing','sent','failed','canceled')),
  lease uuid,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  check((is_test and invitation_id is null and recipient='eduardo.falcao@raizeducacao.com.br') or (not is_test and invitation_id is not null))
);
alter table public.user_access_mail_queue enable row level security;
revoke all on public.user_access_mail_queue from public,anon,authenticated;
grant all on public.user_access_mail_queue to service_role;
create index if not exists user_access_mail_queue_pending on public.user_access_mail_queue(created_at) where state='queued';
create table if not exists public.user_access_mail_worker (
  id boolean primary key default true check(id),
  last_seen timestamptz not null,
  quota integer not null check(quota>=0)
);
alter table public.user_access_mail_worker enable row level security;
revoke all on public.user_access_mail_worker from public,anon,authenticated;
grant all on public.user_access_mail_worker to service_role;

create or replace function public.app_mail_status() returns jsonb
language sql security definer set search_path=public,pg_temp as $$
  select coalesce((select jsonb_build_object('ready',last_seen>now()-interval '5 minutes' and quota>0,'last_seen',last_seen,'quota',quota) from public.user_access_mail_worker where id),'{"ready":false}'::jsonb);
$$;

create or replace function public.app_mail_heartbeat(p_quota integer) returns void
language sql security definer set search_path=public,pg_temp as $$
  insert into public.user_access_mail_worker(id,last_seen,quota) values(true,now(),greatest(0,p_quota))
  on conflict(id) do update set last_seen=excluded.last_seen,quota=excluded.quota;
$$;

create or replace function public.app_mail_enqueue(p_id uuid,p_actor uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.user_access_invitations;
begin
  if not exists(select 1 from public.user_profiles where id=p_actor and aprovado and role='admin') then raise exception 'Acesso negado.' using errcode='42501'; end if;
  select * into i from public.user_access_invitations where id=p_id for update;
  if not found or i.invited_by<>p_actor or i.status<>'sending' or i.expires_at<=now() then raise exception 'Convite indisponivel.'; end if;
  insert into public.user_access_mail_queue(id,invitation_id,actor,recipient) values(i.id,i.id,p_actor,i.email)
  on conflict(id) do nothing;
end $$;

create or replace function public.app_mail_test(p_id uuid,p_actor uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.user_profiles where id=p_actor and aprovado and role='admin' and lower(email)='eduardo.falcao@raizeducacao.com.br') then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if exists(select 1 from public.user_access_mail_queue where is_test and created_at>now()-interval '1 minute' and id<>p_id) then raise exception 'Aguarde antes de testar novamente.'; end if;
  insert into public.user_access_mail_queue(id,actor,recipient,is_test) values(p_id,p_actor,'eduardo.falcao@raizeducacao.com.br',true) on conflict(id) do nothing;
end $$;

create or replace function public.app_mail_claim() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.user_access_mail_queue; i public.user_access_invitations; target public.user_profiles;
begin
  -- An uncertain send is not retried automatically, to prevent duplicate invitations.
  with stale as (
    update public.user_access_mail_queue set state='failed',finished_at=now()
    where (state='processing' and claimed_at<now()-interval '5 minutes') or (state='queued' and created_at<now()-interval '55 minutes') returning invitation_id
  ) update public.user_access_invitations set status='failed',error_code='mail_unconfirmed_or_expired'
    where id in(select invitation_id from stale) and status='sending';
  loop
    select * into q from public.user_access_mail_queue where state='queued' order by created_at for update skip locked limit 1;
    if not found then return null; end if;
    if not exists(select 1 from public.user_profiles where id=q.actor and aprovado and role='admin') then
      update public.user_access_mail_queue set state='canceled',finished_at=now() where id=q.id;
      update public.user_access_invitations set status='revoked' where id=q.invitation_id and status='sending';
      continue;
    end if;
    if not q.is_test then
      select * into i from public.user_access_invitations where id=q.invitation_id for update;
      select * into target from public.user_profiles where lower(email)=q.recipient;
      if i.status<>'sending' or i.expires_at<now()+interval '2 minutes' or
        (target.id is not null and (target.aprovado or target.role='admin' or target.access_revision<>i.expected_revision)) then
        update public.user_access_mail_queue set state='canceled',finished_at=now() where id=q.id;
        update public.user_access_invitations set status='revoked' where id=q.invitation_id and status='sending';
        continue;
      end if;
    end if;
    update public.user_access_mail_queue set state='processing',lease=gen_random_uuid(),claimed_at=now() where id=q.id returning * into q;
    return jsonb_build_object('id',q.id,'lease',q.lease,'to',q.recipient,'is_test',q.is_test,'nome',i.nome,'expires_at',i.expires_at,'invitation_id',q.invitation_id,
      'existing_user',exists(select 1 from auth.users where lower(email)=q.recipient),'access_config',i.access_config);
  end loop;
end $$;

create or replace function public.app_mail_ack(p_id uuid,p_lease uuid,p_success boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.user_access_mail_queue;
begin
  select * into q from public.user_access_mail_queue where id=p_id for update;
  if not found or q.lease is distinct from p_lease then raise exception 'Confirmacao invalida.' using errcode='42501'; end if;
  if q.state in('sent','failed') then return; end if;
  if q.state<>'processing' then raise exception 'Envio nao esta em processamento.'; end if;
  update public.user_access_mail_queue set state=case when p_success then 'sent' else 'failed' end,finished_at=now() where id=p_id;
  if not q.is_test then
    update public.user_access_invitations set status=case when p_success then 'sent' else 'failed' end,
      sent_at=case when p_success then now() else null end,error_code=case when p_success then null else 'mail_unconfirmed' end
      where id=q.invitation_id and status='sending';
  end if;
end $$;

revoke all on function public.app_mail_status(),public.app_mail_heartbeat(integer),public.app_mail_enqueue(uuid,uuid),public.app_mail_test(uuid,uuid),public.app_mail_claim(),public.app_mail_ack(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.app_mail_status(),public.app_mail_heartbeat(integer),public.app_mail_enqueue(uuid,uuid),public.app_mail_test(uuid,uuid),public.app_mail_claim(),public.app_mail_ack(uuid,uuid,boolean) to service_role;
notify pgrst,'reload schema';
