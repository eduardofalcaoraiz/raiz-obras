-- Executed after user_access.sql in the SAME transaction, always rolled back.
create function pg_temp.check_access(ok boolean,msg text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'ACL TEST: %',msg;end if;end $$;
select set_config('test.member',(select id::text from public.user_profiles where not aprovado and role<>'admin' order by criado_em limit 1),true);
select set_config('test.admin',(select id::text from public.user_profiles where aprovado and role='admin' limit 1),true);
select set_config('test.capex_id',(select id::text from public.capex_itens limit 1),true);
select set_config('test.capex_count',(select count(*)::text from public.capex_itens),true);
select set_config('test.profile_count',(select count(*)::text from public.user_profiles),true);

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.member'),true);
select pg_temp.check_access(not public.app_can('capex'),'unapproved user');
select pg_temp.check_access((select count(*) from public.capex_itens)=0,'pending user cannot read');
select pg_temp.check_access((select count(*) from public.user_profiles)=1,'member sees own profile only');
do $$ declare n integer;begin update public.user_profiles set aprovado=true,role='admin' where id=auth.uid();get diagnostics n=row_count;perform pg_temp.check_access(n=0,'self-approval denied');end $$;

reset role;
select set_config('request.jwt.claim.sub','',true);
update public.user_profiles set aprovado=true,access_config='{"capex":"read","realestate_locacoes":"edit"}' where id=current_setting('test.member')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.member'),true);
select pg_temp.check_access(public.app_can('capex') and not public.app_can('capex','edit'),'read-only role');
select pg_temp.check_access(public.app_can('realestate_locacoes','edit') and not public.app_can('realestate_sublocacoes'),'independent real estate areas');
select pg_temp.check_access((select count(*) from public.capex_itens)=current_setting('test.capex_count')::bigint,'authorized data readable');
select pg_temp.check_access((select count(*) from public.real_estate_sublocacoes)=0,'forbidden subleases excluded');
select pg_temp.check_access((select count(*) from public.real_estate_imoveis)>0,'properties visible');
do $$ declare n integer;begin update public.capex_itens set observacoes=observacoes where id::text=current_setting('test.capex_id');get diagnostics n=row_count;perform pg_temp.check_access(n=0,'read-only update denied');delete from public.capex_itens where id::text=current_setting('test.capex_id');get diagnostics n=row_count;perform pg_temp.check_access(n=0,'read-only delete denied');end $$;
do $$ begin
  begin insert into public.capex_saldos(ano,unidade,marca,valor)values(9999,'ACL TEST','ACL',1);raise exception 'ACL TEST: insert allowed';exception when insufficient_privilege then null;end;
  begin perform public.set_user_access(auth.uid(),'{}',0);raise exception 'ACL TEST: member changed access';exception when insufficient_privilege then null;end;
end $$;
select pg_temp.check_access(not public.app_storage_access('contratos','obra_1/contract.pdf'),'inaccessible storage');
select pg_temp.check_access(not public.app_storage_access('documentos','u1/file.pdf','insert'),'document upload denied');
select pg_temp.check_access(not public.app_re_access('["shared-property"]','["shared-sublease"]'),'shared documents require both grants');
select pg_temp.check_access(not has_function_privilege('authenticated','public.raiz_free_tier_maintenance()','execute'),'maintenance RPC blocked');
select pg_temp.check_access(not has_table_privilege('authenticated','public.capex_itens','truncate'),'truncate blocked');

reset role;
select set_config('request.jwt.claim.sub','',true);
update public.user_profiles set access_config='{"capex":"edit"}' where id=current_setting('test.member')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.member'),true);
do $$ declare n integer;begin update public.capex_itens set observacoes=observacoes where id::text=current_setting('test.capex_id');get diagnostics n=row_count;perform pg_temp.check_access(n=1,'authorized update works');end $$;

select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
select pg_temp.check_access(public.app_is_admin(),'administrator preserved');
select pg_temp.check_access((select count(*) from public.user_profiles)=current_setting('test.profile_count')::bigint,'admin manages users');
select public.set_user_access(current_setting('test.member')::uuid,'{"escolas":"read"}',(select access_revision from public.user_profiles where id=current_setting('test.member')::uuid));
do $$ begin
  begin perform public.set_user_access(current_setting('test.member')::uuid,'{}',-1);raise exception 'ACL TEST: stale update allowed';exception when serialization_failure then null;end;
  begin update public.user_profiles set aprovado=false where id=auth.uid();raise exception 'ACL TEST: self lockout allowed';exception when insufficient_privilege then null;end;
end $$;
select pg_temp.check_access(exists(select 1 from public.user_access_audit where actor_id=auth.uid()),'audit trail exists');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select pg_temp.check_access(not has_table_privilege('anon','public.capex_itens','select'),'anonymous table access denied');
select pg_temp.check_access(not public.app_can('capex'),'anonymous permission denied');
reset role;
select true as access_tests_passed;
