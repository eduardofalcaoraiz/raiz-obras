-- Invitation lifecycle is server-only; accepting never trusts browser permissions.
create table if not exists public.user_access_invitations (
  id uuid primary key,
  email text not null,
  nome text not null,
  access_config jsonb not null check(public.app_validate_access(access_config)),
  invited_by uuid not null,
  user_id uuid,
  expected_revision bigint not null default 0,
  status text not null check(status in ('sending','sent','accepted','failed','revoked')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  expires_at timestamptz not null default now()+interval '1 hour',
  accepted_at timestamptz,
  error_code text
);
create index if not exists user_access_invitations_email_idx on public.user_access_invitations(email,created_at desc);
alter table public.user_access_invitations enable row level security;
revoke all on public.user_access_invitations from anon,authenticated;
grant select on public.user_access_invitations to authenticated;
grant all on public.user_access_invitations to service_role;
drop policy if exists admin_read on public.user_access_invitations;
create policy admin_read on public.user_access_invitations for select to authenticated using(public.app_is_admin());

create or replace function public.app_invite_prepare(p_id uuid,p_actor uuid,p_email text,p_nome text,p_config jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.user_access_invitations; p public.user_profiles; uid uuid; v_email text:=lower(trim(p_email));
begin
  if not exists(select 1 from public.user_profiles where id=p_actor and aprovado and role='admin') then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email)>254 or length(trim(p_nome)) not between 2 and 120 then raise exception 'Nome ou e-mail invalido.'; end if;
  if p_config is null or not public.app_validate_access(p_config) or not exists(select 1 from jsonb_each_text(p_config) where value in ('read','edit')) then raise exception 'Defina ao menos uma area de acesso.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_email,0));
  select * into i from public.user_access_invitations where id=p_id;
  if found then
    if i.invited_by<>p_actor or i.email<>v_email or i.access_config<>p_config or i.nome<>trim(p_nome) then raise exception 'Convite conflitante.'; end if;
    return to_jsonb(i)||jsonb_build_object('existing_user',i.user_id is not null,'duplicate',true);
  end if;
  select id into uid from auth.users where lower(auth.users.email)=v_email;
  select * into p from public.user_profiles where id=uid;
  if p.id=p_actor or p.role='admin' or coalesce(p.aprovado,false) then raise exception 'Este usuario ja tem acesso. Edite suas permissoes na lista de pessoas.'; end if;
  if exists(select 1 from public.user_access_invitations where user_access_invitations.email=v_email and created_at>now()-interval '60 seconds') then raise exception 'Aguarde um minuto antes de reenviar.' using errcode='P0429'; end if;
  if (select count(*) from public.user_access_invitations where invited_by=p_actor and created_at>now()-interval '1 hour')>=50 then raise exception 'Limite de convites por hora atingido.' using errcode='P0429'; end if;
  update public.user_access_invitations set status='revoked' where user_access_invitations.email=v_email and status in ('sending','sent');
  insert into public.user_access_invitations(id,email,nome,access_config,invited_by,user_id,expected_revision,status)
    values(p_id,v_email,trim(p_nome),p_config,p_actor,uid,coalesce(p.access_revision,0),'sending') returning * into i;
  return to_jsonb(i)||jsonb_build_object('existing_user',uid is not null,'duplicate',false);
end $$;

create or replace function public.app_invite_delivery(p_id uuid,p_actor uuid,p_success boolean,p_error text default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.user_access_invitations set status=case when p_success then 'sent' else 'failed' end,
    sent_at=case when p_success then now() else null end,error_code=left(p_error,80)
    where id=p_id and invited_by=p_actor and status='sending';
  if not found then raise exception 'O convite mudou durante o envio. Confira a lista.'; end if;
end $$;

create or replace function public.app_invite_revoke(p_id uuid,p_actor uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.user_profiles where id=p_actor and aprovado and role='admin') then raise exception 'Acesso negado.' using errcode='42501'; end if;
  update public.user_access_invitations set status='revoked' where id=p_id and status in ('sent','sending','failed');
  if not found then raise exception 'Convite ja utilizado ou revogado.'; end if;
end $$;

create or replace function public.app_invite_accept(p_id uuid,p_user_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.user_access_invitations; p public.user_profiles; user_email text; confirmed timestamptz; needs_password boolean;
begin
  select lower(email),email_confirmed_at,coalesce(encrypted_password,'')='' into user_email,confirmed,needs_password from auth.users where id=p_user_id;
  if user_email is null or confirmed is null then raise exception 'Confirme seu e-mail para aceitar o convite.' using errcode='42501'; end if;
  select * into i from public.user_access_invitations where id=p_id for update;
  if not found or i.email<>user_email or (i.user_id is not null and i.user_id<>p_user_id) then raise exception 'Este convite pertence a outro e-mail.' using errcode='42501'; end if;
  if i.status='accepted' and i.user_id=p_user_id then return jsonb_build_object('accepted',true,'needs_password',needs_password); end if;
  if i.status<>'sent' or i.expires_at<=now() then raise exception 'Convite expirado, revogado ou ainda nao enviado. Solicite um novo convite.' using errcode='42501'; end if;
  if not exists(select 1 from public.user_profiles where id=i.invited_by and aprovado and role='admin') then raise exception 'O administrador que enviou o convite nao esta mais autorizado.' using errcode='42501'; end if;
  select * into p from public.user_profiles where id=p_user_id for update;
  if not found or p.role='admin' or p.aprovado or p.access_revision<>i.expected_revision then raise exception 'As permissoes mudaram apos este convite. Solicite um novo convite.' using errcode='40001'; end if;
  -- Attribute the profile audit to the administrator who authorized this invitation.
  perform set_config('request.jwt.claim.sub',i.invited_by::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',i.invited_by,'role','authenticated')::text,true);
  update public.user_profiles set nome=i.nome,role='leitor',aprovado=true,access_config=i.access_config where id=p_user_id;
  update public.user_access_invitations set status='accepted',accepted_at=now(),user_id=p_user_id where id=p_id;
  return jsonb_build_object('accepted',true,'needs_password',needs_password);
end $$;

revoke all on function public.app_invite_prepare(uuid,uuid,text,text,jsonb),public.app_invite_delivery(uuid,uuid,boolean,text),public.app_invite_revoke(uuid,uuid),public.app_invite_accept(uuid,uuid) from public,anon,authenticated;
grant execute on function public.app_invite_prepare(uuid,uuid,text,text,jsonb),public.app_invite_delivery(uuid,uuid,boolean,text),public.app_invite_revoke(uuid,uuid),public.app_invite_accept(uuid,uuid) to service_role;
notify pgrst,'reload schema';
