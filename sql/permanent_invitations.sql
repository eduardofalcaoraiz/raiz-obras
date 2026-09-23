-- Persistent invitation secrets are never readable by browser roles.
alter table public.user_access_invitations alter column expires_at drop not null;
alter table public.user_access_invitations alter column expires_at drop default;
update public.user_access_invitations set expires_at=null where expires_at is not null;
create table if not exists public.user_access_invite_links (
  invitation_id uuid primary key references public.user_access_invitations(id),
  token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$'),
  last_opened_at timestamptz
);
alter table public.user_access_invite_links enable row level security;
revoke all on public.user_access_invite_links from public,anon,authenticated;
grant all on public.user_access_invite_links to service_role;

create or replace function public.app_invite_link_save(p_id uuid,p_lease uuid,p_hash text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.user_access_mail_queue q join public.user_access_invitations i on i.id=q.invitation_id
    where q.id=p_id and q.lease=p_lease and q.state='processing' and not q.is_test and i.status='sending') then
    raise exception 'Convite indisponivel.' using errcode='42501';
  end if;
  insert into public.user_access_invite_links(invitation_id,token_hash) values(p_id,p_hash)
    on conflict(invitation_id) do update set token_hash=excluded.token_hash,last_opened_at=null;
end $$;

create or replace function public.app_invite_link_open(p_id uuid,p_hash text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.user_access_invitations; l public.user_access_invite_links; p public.user_profiles;
begin
  select * into i from public.user_access_invitations where id=p_id for update;
  if not found or i.status<>'sent' then raise exception 'Convite indisponivel.' using errcode='42501'; end if;
  select * into l from public.user_access_invite_links where invitation_id=p_id;
  if not found or l.token_hash is distinct from p_hash then raise exception 'Convite indisponivel.' using errcode='42501'; end if;
  if not exists(select 1 from public.user_profiles where id=i.invited_by and aprovado and role='admin') then
    raise exception 'Convite indisponivel.' using errcode='42501';
  end if;
  select * into p from public.user_profiles where lower(email)=i.email;
  if found and (p.aprovado or p.role='admin' or p.access_revision<>i.expected_revision or (i.user_id is not null and p.id<>i.user_id)) then
    raise exception 'Convite indisponivel.' using errcode='42501';
  end if;
  if l.last_opened_at>now()-interval '10 seconds' then raise exception 'Aguarde alguns segundos.' using errcode='P0429'; end if;
  update public.user_access_invite_links set last_opened_at=now() where invitation_id=p_id;
  return jsonb_build_object('email',i.email,'nome',i.nome,'existing_user',exists(select 1 from auth.users where lower(email)=i.email));
end $$;
revoke all on function public.app_invite_link_save(uuid,uuid,text),public.app_invite_link_open(uuid,text) from public,anon,authenticated;
grant execute on function public.app_invite_link_save(uuid,uuid,text),public.app_invite_link_open(uuid,text) to service_role;
notify pgrst,'reload schema';
