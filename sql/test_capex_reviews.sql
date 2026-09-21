-- Run ONLY after capex_reviews.sql, in the SAME transaction; always ROLLBACK.
-- The runner must issue BEGIN before both files. No production fixtures are used.
create temp table review_test_results(label text primary key) on commit drop;
create temp table review_test_context(review_id bigint, version text, snapshot jsonb) on commit drop;
grant all on review_test_results,review_test_context to authenticated,anon,service_role;
create function pg_temp.review_assert(ok boolean,label text) returns void
language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
  insert into review_test_results values(label);
end $$;
create function pg_temp.review_throws(command text,code text,label text) returns void
language plpgsql as $$ begin
  begin
    execute command;
  exception when others then
    if sqlstate<>code then raise exception 'FAIL: %, expected %, got % (%)',label,code,sqlstate,sqlerrm; end if;
    insert into review_test_results values(label);
    return;
  end;
  raise exception 'FAIL: %, command succeeded',label;
end $$;

-- Auth inserts invoke the existing profile trigger. Replace only synthetic profiles
-- by INSERT to avoid advancing the production access-audit sequence on UPDATE.
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-00000000ca01','capex-reader@test.invalid'),
 ('00000000-0000-4000-8000-00000000ca02','capex-admin@test.invalid'),
 ('00000000-0000-4000-8000-00000000ca03','capex-denied@test.invalid'),
 ('00000000-0000-4000-8000-00000000ca04','capex-unapproved@test.invalid'),
 ('00000000-0000-4000-8000-00000000ca05','capex-other-reader@test.invalid'),
 ('00000000-0000-4000-8000-00000000ca06','capex-registros@test.invalid');
delete from public.user_profiles where id in
 ('00000000-0000-4000-8000-00000000ca01','00000000-0000-4000-8000-00000000ca02',
  '00000000-0000-4000-8000-00000000ca03','00000000-0000-4000-8000-00000000ca04',
  '00000000-0000-4000-8000-00000000ca05','00000000-0000-4000-8000-00000000ca06');
insert into public.user_profiles(id,email,nome,role,aprovado,access_config) values
 ('00000000-0000-4000-8000-00000000ca01','capex-reader@test.invalid','Reader','leitor',true,'{"capex":"read"}'),
 ('00000000-0000-4000-8000-00000000ca02','capex-admin@test.invalid','Admin','admin',true,'{}'),
 ('00000000-0000-4000-8000-00000000ca03','capex-denied@test.invalid','Denied','leitor',true,'{}'),
 ('00000000-0000-4000-8000-00000000ca04','capex-unapproved@test.invalid','Unapproved','admin',false,'{"capex":"read"}'),
 ('00000000-0000-4000-8000-00000000ca05','capex-other-reader@test.invalid','Other','leitor',true,'{"capex":"read"}'),
 ('00000000-0000-4000-8000-00000000ca06','capex-registros@test.invalid','Registros only','leitor',true,'{"registros":"read"}');
insert into public.capex_itens(id,ano,unidade,orcamento,ticket_raiz_instance_id,docs_json) values
 (-2147483001,2099,'CAPEX TEST',100,-2147483001,'[{"storagePath":"test/retained.pdf"}]'),
 (-2147483002,2099,'CAPEX TEST',50,-2147483002,'[]');
insert into public.capex_zeev_solicitacoes(id,zeev_instance_id,capex_item_id,status,docs_json)
 values(-2147483001,-2147483001,-2147483001,'aprovado','[{"storagePath":"test/queue.pdf"}]');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000ca01',true);
select pg_temp.review_assert(public.app_can('capex') and not public.app_can('capex','edit'),'read-only fixture');
select pg_temp.review_assert((select sum(orcamento)=150 from public.capex_itens where id in (-2147483001,-2147483002)),'initial active balance');
select pg_temp.review_throws($q$select public.request_capex_review(-2147483001,'short')$q$,'22023','invalid request reason');
insert into review_test_context(review_id) select id from public.request_capex_review(-2147483001,'Not a CAPEX expense');
update review_test_context set version=public.get_capex_review(review_id)->>'version';
select pg_temp.review_assert((select count(*)=1 from public.capex_reviews),'reader can request and read own review');
select pg_temp.review_throws($q$select public.request_capex_review(-2147483001,'Duplicate review request')$q$,'23505','duplicate pending');
select pg_temp.review_throws($q$select public.decide_capex_review(review_id,true,'Approved',version) from review_test_context$q$,'42501','reader cannot approve');
select pg_temp.review_throws($q$update public.capex_reviews set status='approved'$q$,'42501','direct review mutation denied');
select pg_temp.review_throws($q$delete from public.capex_reviews$q$,'42501','direct audit deletion denied');
select pg_temp.review_throws($q$insert into public.capex_reviews(item_id) values(-2147483002)$q$,'42501','direct request insert denied');
with changed as (update public.capex_itens set orcamento=999 where id=-2147483001 returning id)
 select pg_temp.review_assert(not exists(select from changed),'reader cannot edit expense');
with changed as (delete from public.capex_itens where id=-2147483002 returning id)
 select pg_temp.review_assert(not exists(select from changed),'reader cannot delete expense');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000ca05',true);
select pg_temp.review_assert((select count(*)=0 from public.capex_reviews),'other reader RLS isolation');
select pg_temp.review_throws($q$select public.get_capex_review(review_id) from review_test_context$q$,'42501','other reader RPC isolation');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000ca03',true);
select pg_temp.review_throws($q$select public.request_capex_review(-2147483002,'No module permission')$q$,'42501','no CAPEX permission');
select pg_temp.review_assert((select count(*)=0 from public.capex_itens),'denied expense RLS');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000ca04',true);
select pg_temp.review_throws($q$select public.request_capex_review(-2147483002,'Not approved account')$q$,'42501','unapproved admin request denied');
select pg_temp.review_throws($q$select public.decide_capex_review(review_id,false,'Rejected',version) from review_test_context$q$,'42501','unapproved admin decision denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000ca02',true);
select pg_temp.review_assert((select count(*)=1 from public.capex_reviews),'registros access to review queue');
select pg_temp.review_throws($q$select public.decide_capex_review(review_id,true,'Approved',version) from review_test_context$q$,'42501','nonowner admin cannot approve');
select pg_temp.review_throws($q$select public.decide_capex_review(review_id,false,'Rejected',version) from review_test_context$q$,'42501','nonowner admin cannot reject');
with changed as (delete from public.capex_itens where id=-2147483002 returning id)
 select pg_temp.review_assert(not exists(select from changed),'nonowner admin cannot delete expense');

select set_config('request.jwt.claim.sub','e56ab877-62a8-4f2c-9ef8-55ab93fd51b9',true);
select pg_temp.review_assert(public.capex_review_is_owner(),'Eduardo approved admin precondition');
select pg_temp.review_throws($q$select public.decide_capex_review(review_id,true,null,version) from review_test_context$q$,'22023','decision reason required');
select pg_temp.review_throws($q$select public.decide_capex_review(review_id,true,'Approved',null) from review_test_context$q$,'40001','version required');
update public.capex_itens set orcamento=110 where id=-2147483001;
select pg_temp.review_throws($q$select public.decide_capex_review(review_id,true,'Approved',version) from review_test_context$q$,'40001','stale amount version');
update review_test_context set version=public.get_capex_review(review_id)->>'version';
update public.capex_itens set docs_json=docs_json||'[{"storagePath":"test/second.pdf"}]'::jsonb where id=-2147483001;
select pg_temp.review_throws($q$select public.decide_capex_review(review_id,true,'Approved',version) from review_test_context$q$,'40001','stale document version');
update review_test_context set version=public.get_capex_review(review_id)->>'version';
select public.decide_capex_review(review_id,false,'Still valid CAPEX',version) from review_test_context;
select pg_temp.review_assert((select sum(orcamento)=160 from public.capex_itens where id in (-2147483001,-2147483002)),'rejection preserves active balance');
select pg_temp.review_assert((select status='aprovado' from public.capex_zeev_solicitacoes where id=-2147483001),'rejection preserves queue');
select pg_temp.review_throws($q$select public.decide_capex_review(review_id,true,'Approved',version) from review_test_context$q$,'40001','cannot decide twice');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000ca01',true);
delete from review_test_context;
insert into review_test_context(review_id) select id from public.request_capex_review(-2147483001,'Reconsider classification');
select pg_temp.review_assert((select count(*)=2 from public.capex_reviews),'new request after rejection');
select set_config('request.jwt.claim.sub','e56ab877-62a8-4f2c-9ef8-55ab93fd51b9',true);
update review_test_context set version=public.get_capex_review(review_id)->>'version',snapshot=public.get_capex_review(review_id)->'current_item';
select public.decide_capex_review(review_id,true,'Reclassified outside CAPEX',version) from review_test_context;
select pg_temp.review_assert((select sum(orcamento)=50 from public.capex_itens where id in (-2147483001,-2147483002)),'approval removes expense from active balance');
select pg_temp.review_assert((select status='ignorado' and capex_item_id=-2147483001 from public.capex_zeev_solicitacoes where id=-2147483001),'approval marks queue ignored');
select pg_temp.review_assert((select r.decision_snapshot=c.snapshot and r.decided_by=auth.uid() and r.status='approved' from public.capex_reviews r join review_test_context c on c.review_id=r.id),'approval snapshot and owner audit');
select pg_temp.review_throws($q$select public.request_capex_review(-2147483001,'Already excluded expense')$q$,'P0001','excluded expense cannot request again');
with changed as (update public.capex_itens set orcamento=999 where id=-2147483001 returning id)
 select pg_temp.review_assert(not exists(select from changed),'owner cannot edit excluded row through RLS');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000ca01',true);
select pg_temp.review_assert((select count(*)=0 from public.capex_itens where id=-2147483001),'reader cannot see excluded expense');
select pg_temp.review_assert((select public.get_capex_review(review_id)->'current_item'->'docs_json'=snapshot->'docs_json' from review_test_context),'requester retains reviewed documents metadata');
select pg_temp.review_assert(not public.app_storage_access('pagamentos','test/retained.pdf'),'existing storage limitation: archived requester file inaccessible');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000ca06',true);
select pg_temp.review_assert((select count(*)=0 from public.capex_reviews),'registros alone cannot read CAPEX reviews');
select pg_temp.review_throws($q$select public.get_capex_review(review_id) from review_test_context$q$,'42501','registros alone cannot call review RPC');

reset role;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.review_assert((select count(*)=1 from public.capex_itens where id=-2147483001),'physical expense retained');
select pg_temp.review_assert((select docs_json='[{"storagePath":"test/queue.pdf"}]'::jsonb from public.capex_zeev_solicitacoes where id=-2147483001),'queue documents retained');
select pg_temp.review_throws($q$delete from public.capex_itens where id=-2147483001$q$,'23503','review history prevents physical deletion');
select pg_temp.review_throws($q$update public.capex_reviews set decision_reason=null where status='approved'$q$,'23514','null audit reason constraint');
set local role service_role;
update public.capex_itens set pedido='Sync refreshed description',orcamento=120 where id=-2147483001;
update public.capex_zeev_solicitacoes set status='pendente',capex_item_id=null,ignorado_por=null,ignorado_em=null where id=-2147483001;
select pg_temp.review_assert((select status='ignorado' and capex_item_id=-2147483001 and ignorado_em is not null and ignorado_por is not null from public.capex_zeev_solicitacoes where id=-2147483001),'queueguard clears attempted unlink');
update public.capex_zeev_solicitacoes set status='aprovado',capex_item_id=-2147483002 where id=-2147483001;
select pg_temp.review_assert((select status='ignorado' and capex_item_id=-2147483001 from public.capex_zeev_solicitacoes where id=-2147483001),'queueguard prevents relink');
insert into public.capex_zeev_solicitacoes(id,zeev_instance_id,capex_item_id,status)
 values(-2147483002,-2147483002,-2147483001,'pendente');
select pg_temp.review_assert((select status='ignorado' from public.capex_zeev_solicitacoes where id=-2147483002),'queueguard insert linked expense');
delete from public.capex_zeev_solicitacoes where id=-2147483001;
insert into public.capex_zeev_solicitacoes(id,zeev_instance_id,status) values(-2147483001,-2147483001,'pendente');
select pg_temp.review_assert((select status='ignorado' and capex_item_id=-2147483001 from public.capex_zeev_solicitacoes where id=-2147483001),'queueguard recreated ticket without FK');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e56ab877-62a8-4f2c-9ef8-55ab93fd51b9',true);
select pg_temp.review_assert((select sum(orcamento)=50 from public.capex_itens where id in (-2147483001,-2147483002)),'sync cannot resurrect active balance');
select pg_temp.review_assert((select r.decision_snapshot=c.snapshot from public.capex_reviews r join review_test_context c on c.review_id=r.id),'sync preserves approval snapshot');
set local role anon;
select pg_temp.review_throws($q$select public.request_capex_review(-2147483002,'Anonymous request denied')$q$,'42501','anonymous RPC denied');
select pg_temp.review_throws($q$select * from public.capex_reviews$q$,'42501','anonymous table denied');
reset role;
-- Runner reads this result, then issues ROLLBACK in the same query batch.
select count(*) as passed, array_agg(label order by label) as tests from review_test_results;
