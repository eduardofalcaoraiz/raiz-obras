-- Keep failed/partial imports eligible; retire only completed document checks.
do $$
declare definition text; old_queue text; new_queue text; old_fiscal text; new_fiscal text;
begin
 select pg_get_functiondef('public.raiz_doc_rescue_audit(integer,integer,integer)'::regprocedure) into definition;
 if position('terminal_import_complete' in definition)>0 then return; end if;
 old_queue:=$old$queue as (
  select distinct tr_num
  from states
  where never_checked
     or not fresh
     or (target = 'payment' and not has_fiscal)
)$old$;
 new_queue:=$new$terminal_import_complete as (
  select s.target,s.row_id
  from states s
  join public.capex_zeev_solicitacoes z on z.zeev_instance_id=s.tr_num
  cross join lateral (
    select doc.value->>'status' status
    from jsonb_array_elements(s.docs) with ordinality doc(value,position)
    where doc.value->>'kind' in ('ZEEV_AUDIT','AUDITORIA_ZEEV') or doc.value->>'system'='true'
    order by doc.position desc limit 1
  ) audit
  where z.active=false and z.valor>0 and s.zeev_docs_checked_at is not null
    and audit.status in ('concluido','ja_anexado','sem_documento_no_zeev')
),
queue as (
  select distinct tr_num
  from states s
  where (never_checked or not fresh or (target = 'payment' and not has_fiscal))
    and not exists(select 1 from terminal_import_complete t where t.target=s.target and t.row_id=s.row_id)
)$new$;
 old_fiscal:=$old$from states
  where target = 'payment'
    and not has_fiscal
    and (never_checked or not fresh)$old$;
 new_fiscal:=$new$from states s
  where target = 'payment'
    and not has_fiscal
    and (never_checked or not fresh)
    and not exists(select 1 from terminal_import_complete t where t.target=s.target and t.row_id=s.row_id)$new$;
 if position(old_queue in definition)=0 or position(old_fiscal in definition)=0 then raise exception 'Unexpected document queue definition; inspect before changing'; end if;
 definition:=replace(replace(definition,old_queue,new_queue),old_fiscal,new_fiscal);
 execute definition;
end $$;
select public.raiz_doc_rescue_audit(24,60,24)->'queue' as queue;
