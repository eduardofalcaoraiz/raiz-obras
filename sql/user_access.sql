-- Per-person module permissions. Does not change approvals or business records.
-- Run atomically, after testing against the current schema.
alter table public.user_profiles add column if not exists access_config jsonb;
alter table public.user_profiles add column if not exists access_revision bigint not null default 0;

create table if not exists public.user_access_audit (
  id bigint generated always as identity primary key,
  actor_id uuid,
  user_id uuid not null,
  before_state jsonb not null,
  after_state jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.user_access_audit enable row level security;

create or replace function public.app_is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.user_profiles where id=auth.uid() and aprovado and role='admin');
$$;

create or replace function public.app_can(p_module text, p_action text default 'read') returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare p public.user_profiles; level text;
begin
  if p_action not in ('read','edit','document') then return false; end if;
  if p_module not in ('escolas','capex','registros','realestate_locacoes','realestate_sublocacoes','expansao','nova','cobranca','forn','investidores') then return false; end if;
  select * into p from public.user_profiles where id=auth.uid();
  if not found or not coalesce(p.aprovado,false) then return false; end if;
  if p.role='admin' then return true; end if;
  if p.access_config is null then
    return p_action='read' or p.role='editor' or (p_action='document' and p_module='escolas' and p.role='doc');
  end if;
  level:=p.access_config->>p_module;
  return coalesce(level='edit' or (p_action='read' and level='read'),false);
end;
$$;

create or replace function public.app_re_access(p_imoveis jsonb, p_sublocacoes jsonb) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select case
    when coalesce(jsonb_array_length(p_imoveis),0)+coalesce(jsonb_array_length(p_sublocacoes),0)=0
      then public.app_can('realestate_locacoes') and public.app_can('realestate_sublocacoes')
    else (coalesce(jsonb_array_length(p_imoveis),0)=0 or public.app_can('realestate_locacoes'))
      and (coalesce(jsonb_array_length(p_sublocacoes),0)=0 or public.app_can('realestate_sublocacoes'))
  end;
$$;

create or replace function public.app_obra_access(p_id bigint, p_action text default 'read') returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.obras o where o.id=p_id
    and public.app_can(case when o.esfera in ('capex','expansao','nova') then o.esfera else 'nova' end,p_action));
$$;

create or replace function public.app_validate_access(p_config jsonb) returns boolean
language sql immutable set search_path = public, pg_temp as $$
  select case when p_config is null then true when jsonb_typeof(p_config)<>'object' then false else
    not exists(select 1 from jsonb_each(p_config) e where
      e.key not in ('escolas','capex','registros','realestate_locacoes','realestate_sublocacoes','expansao','nova','cobranca','forn','investidores')
      or jsonb_typeof(e.value)<>'string' or e.value#>>'{}' not in ('none','read','edit')) end;
$$;

create or replace function public.app_profile_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op='INSERT' then
    if auth.uid() is not null and not public.app_is_admin() then
      if new.id<>auth.uid() or new.aprovado or new.role<>'leitor' or coalesce(new.access_config,'{}')<>'{}'::jsonb then
        raise exception 'Novo perfil deve aguardar autorizacao do administrador.' using errcode='42501';
      end if;
      new.access_config:='{}'::jsonb;
    end if;
    return new;
  end if;
  if not public.app_validate_access(new.access_config) then raise exception 'Permissoes invalidas.'; end if;
  if auth.uid() is not null and not public.app_is_admin() then raise exception 'Somente o administrador pode alterar acessos.' using errcode='42501'; end if;
  if auth.uid()=old.id and (new.role is distinct from old.role or new.aprovado is distinct from old.aprovado or new.access_config is distinct from old.access_config) then
    raise exception 'Nao e permitido alterar o proprio acesso.' using errcode='42501';
  end if;
  new.access_revision:=old.access_revision+1;
  insert into public.user_access_audit(actor_id,user_id,before_state,after_state)
    values(auth.uid(),old.id,to_jsonb(old)-'email'-'nome',to_jsonb(new)-'email'-'nome');
  return new;
end;
$$;
drop trigger if exists app_profile_guard on public.user_profiles;
create trigger app_profile_guard before insert or update on public.user_profiles for each row execute function public.app_profile_guard();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.user_profiles(id,email,nome,role,aprovado,access_config)
    values(new.id,new.email,coalesce(new.raw_user_meta_data->>'nome',split_part(new.email,'@',1)),'leitor',false,'{}')
    on conflict(id) do nothing;
  return new;
end;
$$;

create or replace function public.set_user_access(p_user_id uuid,p_config jsonb,p_revision bigint) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.app_is_admin() or p_user_id=auth.uid() then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if p_config is null or not public.app_validate_access(p_config) then raise exception 'Permissoes invalidas.'; end if;
  update public.user_profiles set access_config=p_config where id=p_user_id and access_revision=p_revision and role<>'admin';
  if not found then raise exception 'Perfil alterado por outra sessao ou perfil administrador. Reabra as permissoes.' using errcode='40001'; end if;
end;
$$;

-- Replace broad policies: an OR-connected legacy allow-all policy would defeat the ACL.
do $$ declare p record; t text; expr text;
begin
  for p in select * from pg_policies where schemaname='public' and tablename in
    ('user_profiles','obras','pagamentos','aportes','contratos','unidades','documentos_unidade','categorias','fornecedores_cnpj','investidores','capex_itens','capex_saldos','capex_zeev_solicitacoes','zeev_sync_state','real_estate_imoveis','real_estate_sublocacoes','real_estate_documentos','real_estate_lancamentos','real_estate_tickets','user_access_audit')
  loop execute format('drop policy %I on public.%I',p.policyname,p.tablename); end loop;

  for t,expr in select * from (values
    ('obras','public.app_can(case when esfera in (''capex'',''expansao'',''nova'') then esfera else ''nova'' end, %L)'),
    ('pagamentos','public.app_obra_access(obra_id, %L)'),
    ('aportes','public.app_obra_access(obra_id, %L)'),
    ('contratos','public.app_obra_access(obra_id, %L)'),
    ('documentos_unidade','public.app_can(''escolas'', %L)'),
    ('capex_itens','public.app_can(''capex'', %L)'),
    ('capex_saldos','public.app_can(''capex'', %L)'),
    ('capex_zeev_solicitacoes','public.app_can(''registros'', %L)'),
    ('real_estate_imoveis','public.app_can(''realestate_locacoes'', %L)'),
    ('real_estate_sublocacoes','public.app_can(''realestate_sublocacoes'', %L)'),
    ('fornecedores_cnpj','public.app_can(''forn'', %L)'),
    ('investidores','public.app_can(''investidores'', %L)')
  ) m(t,expr) loop
    execute format('create policy access_read on public.%I for select to authenticated using (%s)',t,format(expr,'read'));
    execute format('create policy access_insert on public.%I for insert to authenticated with check (%s)',t,format(expr,case when t='documentos_unidade' then 'document' else 'edit' end));
    execute format('create policy access_update on public.%I for update to authenticated using (%s) with check (%s)',t,format(expr,'edit'),format(expr,'edit'));
    execute format('create policy access_delete on public.%I for delete to authenticated using (%s)',t,format(expr,'edit'));
  end loop;
end $$;

create policy access_read on public.unidades for select to authenticated using (exists(select 1 from public.user_profiles where id=auth.uid() and aprovado));
create policy access_write on public.unidades for all to authenticated using (public.app_can('escolas','edit')) with check(public.app_can('escolas','edit'));
create policy access_read on public.categorias for select to authenticated using (exists(select 1 from public.user_profiles where id=auth.uid() and aprovado));
create policy access_write on public.categorias for all to authenticated using (public.app_is_admin()) with check(public.app_is_admin());
create policy access_read on public.user_profiles for select to authenticated using (id=auth.uid() or public.app_is_admin());
create policy access_insert on public.user_profiles for insert to authenticated with check (id=auth.uid() and role='leitor' and not aprovado and coalesce(access_config,'{}')='{}'::jsonb);
create policy access_update on public.user_profiles for update to authenticated using(public.app_is_admin()) with check(public.app_is_admin());
create policy access_read on public.user_access_audit for select to authenticated using(public.app_is_admin());
create policy access_read on public.zeev_sync_state for select to authenticated using(public.app_is_admin());
create policy access_read on public.real_estate_lancamentos for select to authenticated using(
  public.app_re_access(case when imovel_id is null then '[]'::jsonb else jsonb_build_array(imovel_id) end,case when sublocacao_id is null then '[]'::jsonb else jsonb_build_array(sublocacao_id) end));
create policy access_read on public.real_estate_documentos for select to authenticated using(public.app_re_access(to_jsonb(imovel_ids),to_jsonb(sublocacao_ids)));
create policy access_read on public.real_estate_tickets for select to authenticated using(public.app_re_access(to_jsonb(imovel_ids),to_jsonb(sublocacao_ids)));

-- Storage authorization follows linked records. Unknown/legacy paths remain admin-only.
create or replace function public.app_storage_access(p_bucket text,p_name text,p_action text default 'read') returns boolean
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare ob bigint; section text:=split_part(p_name,'/',1);
begin
  if public.app_is_admin() then return true; end if;
  if p_bucket not in ('documentos','pagamentos','contratos') then return false; end if;
  if p_bucket='documentos' and section ~ '^u[0-9]+$' then
    return public.app_can('escolas',case when p_action='insert' then 'document' else p_action end);
  end if;
  if section ~ '^obra_[0-9]+$' then
    ob:=substring(section from 6)::bigint;
    return public.app_obra_access(ob,case when p_action='insert' then 'edit' else p_action end);
  end if;
  if section='real_estate' then return public.app_can('realestate_locacoes',case when p_action='insert' then 'edit' else p_action end); end if;
  if p_action<>'read' then return false; end if;
  if p_bucket='contratos' and exists(select 1 from public.contratos where contrato_doc_path=p_name) then return true; end if;
  if p_bucket='documentos' and exists(select 1 from public.documentos_unidade where storage_path=p_name) then return true; end if;
  if p_bucket='pagamentos' then
    if exists(select 1 from public.pagamentos where nf_doc_path=p_name or comp_doc_path=p_name or docs_json @> jsonb_build_array(jsonb_build_object('storagePath',p_name))) then return true; end if;
    if exists(select 1 from public.capex_itens where docs_json @> jsonb_build_array(jsonb_build_object('storagePath',p_name))) then return true; end if;
    if exists(select 1 from public.capex_zeev_solicitacoes where docs_json @> jsonb_build_array(jsonb_build_object('storagePath',p_name))) then return true; end if;
  end if;
  return false;
end;
$$;
do $$ declare p record;
begin
  for p in select * from pg_policies where schemaname='storage' and tablename='objects' loop
    execute format('drop policy %I on storage.objects',p.policyname);
  end loop;
end $$;
create policy access_read on storage.objects for select to authenticated using(public.app_storage_access(bucket_id,name));
create policy access_insert on storage.objects for insert to authenticated with check(public.app_storage_access(bucket_id,name,'insert'));
create policy access_update on storage.objects for update to authenticated using(public.app_storage_access(bucket_id,name,'edit')) with check(public.app_storage_access(bucket_id,name,'edit'));
create policy access_delete on storage.objects for delete to authenticated using(public.app_storage_access(bucket_id,name,'edit'));
update storage.buckets set public=false where id in ('documentos','pagamentos','contratos');

-- Privileged maintenance RPCs must never be executable by a browser session.
do $$ declare f record;
begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef and p.proname not in ('app_can','app_is_admin','app_obra_access','set_user_access')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
revoke all on function public.set_user_access(uuid,jsonb,bigint) from public,anon;
grant execute on function public.set_user_access(uuid,jsonb,bigint) to authenticated;
grant select on public.user_access_audit to authenticated;
do $$ declare t record;
begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('revoke all on public.%I from anon',t.tablename);
    execute format('revoke truncate, references, trigger on public.%I from authenticated',t.tablename);
  end loop;
end $$;
notify pgrst,'reload schema';
