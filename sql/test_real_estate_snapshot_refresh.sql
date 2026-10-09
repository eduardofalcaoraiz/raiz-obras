-- Run only in a disposable/staging database after installing the refresh RPC.
begin;
do $$
declare c jsonb; s jsonb; n integer; u text;
begin
 if exists(select 1 from public.real_estate_tickets where ticket_raiz='99999998') then
   raise exception 'Test ticket already exists';
 end if;
 insert into public.real_estate_tickets(ticket_raiz,imovel_ids,ticket_url,valor_total,vinculo_revisar)
 values('99999998',array['11111111-1111-1111-1111-111111111111'::uuid],
   'https://raizeducacao.zeev.it/2.0/request/instance/99999998',100,false);
 select to_jsonb(t)-'sincronizado_em' into s from public.real_estate_tickets t where ticket_raiz='99999998';
 c:=jsonb_build_object('ticket_raiz','99999998','snapshot',s,'source_fingerprint','test-baseline');
 perform public.refresh_real_estate_snapshot(c);
 if not exists(select 1 from public.real_estate_sync_state where name='snapshot-source:99999998') then raise exception 'Missing baseline'; end if;
 c:=jsonb_set(c,'{snapshot,valor_total}','120');
 c:=jsonb_set(c,'{source_fingerprint}','"test-source-change"');
 perform public.refresh_real_estate_snapshot(c);
 if (select valor_total from public.real_estate_tickets where ticket_raiz='99999998')<>120 then raise exception 'Source update blocked'; end if;
 update public.real_estate_tickets set valor_total=125 where ticket_raiz='99999998';
 c:=jsonb_set(c,'{snapshot,valor_total}','130');
 c:=jsonb_set(c,'{snapshot,status}','"Em andamento"');
 c:=jsonb_set(c,'{source_fingerprint}','"test-manual-conflict"');
 perform public.refresh_real_estate_snapshot(c);
 if (select valor_total from public.real_estate_tickets where ticket_raiz='99999998')<>125 then raise exception 'Manual edit overwritten'; end if;
 if (select status from public.real_estate_tickets where ticket_raiz='99999998')<>'Em andamento' then raise exception 'Operational update blocked'; end if;
 if not exists(select 1 from public.real_estate_pending where ticket_raiz='99999998' and status='pending') then raise exception 'Conflict not queued'; end if;
 update public.real_estate_tickets set valor_total=120,imovel_ids=array['11111111-1111-1111-1111-111111111111'::uuid,'22222222-2222-2222-2222-222222222222'::uuid] where ticket_raiz='99999998';
 perform public.refresh_real_estate_snapshot(c);
 if (select valor_total from public.real_estate_tickets where ticket_raiz='99999998')<>120 then raise exception 'Shared allocation overwritten'; end if;
 c:=jsonb_set(c,'{snapshot,ticket_url}','"https://raizeducacao.zeev.it/audit?token=renewed"');
 perform public.refresh_real_estate_snapshot(c);
 if (select ticket_url from public.real_estate_tickets where ticket_raiz='99999998')<>'https://raizeducacao.zeev.it/audit?token=renewed' then raise exception 'Official URL not refreshed'; end if;
 foreach u in array array['','http://raizeducacao.zeev.it/audit','https://raizeducacao.zeev.it.evil.test/audit','https://raizeducacao.zeev.it@evil.test/audit',E'https://raizeducacao.zeev.it/audit\ninvalid'] loop
   c:=jsonb_set(c,'{snapshot,ticket_url}',to_jsonb(u));
   perform public.refresh_real_estate_snapshot(c);
   if (select ticket_url from public.real_estate_tickets where ticket_raiz='99999998')<>'https://raizeducacao.zeev.it/audit?token=renewed' then raise exception 'Invalid URL replaced existing URL'; end if;
 end loop;
 c:=jsonb_set(c,'{snapshot,ticket_url}','null');
 perform public.refresh_real_estate_snapshot(c);
 c:=c#-'{snapshot,ticket_url}';
 perform public.refresh_real_estate_snapshot(c);
 if (select ticket_url from public.real_estate_tickets where ticket_raiz='99999998')<>'https://raizeducacao.zeev.it/audit?token=renewed' then raise exception 'Absent URL erased existing URL'; end if;
 select count(*) into n from public.real_estate_lancamentos where ticket_raiz='99999998';
 if n<>0 then raise exception 'Ledger created'; end if;
end;
$$;
rollback;
