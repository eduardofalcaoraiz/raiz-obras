-- Run in a transaction and roll back. Never creates a real email.
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at,encrypted_password,aud,role) values
 ('a2222222-2222-4222-8222-222222222222','queue-admin@example.test','{}',now(),'test','authenticated','authenticated'),
 ('b2222222-2222-4222-8222-222222222222','queue-person@example.test','{}',now(),'','authenticated','authenticated');
update public.user_profiles set role='admin',aprovado=true where id='a2222222-2222-4222-8222-222222222222';
do $$
declare a uuid:='a2222222-2222-4222-8222-222222222222'; u uuid:='b2222222-2222-4222-8222-222222222222'; i uuid:=gen_random_uuid(); j uuid:=gen_random_uuid(); q jsonb; blocked boolean;
begin
  if has_table_privilege('authenticated','public.user_access_mail_queue','select') or has_function_privilege('anon','public.app_mail_claim()','execute') or has_function_privilege('authenticated','public.app_mail_ack(uuid,uuid,boolean)','execute') then raise exception 'Mail queue exposed to browser'; end if;
  blocked:=false;
  begin perform public.app_mail_test(i,a); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Test mail allowed for another account'; end if;
  perform public.app_invite_prepare(i,a,'queue-person@example.test','Test','{"capex":"read"}');
  perform public.app_mail_enqueue(i,a);
  perform public.app_mail_enqueue(i,a);
  if (select count(*) from public.user_access_mail_queue where id=i)<>1 then raise exception 'Duplicate queue'; end if;
  q:=public.app_mail_claim();
  if q->>'id'<>i::text or q->>'to'<>'queue-person@example.test' or not(q->>'existing_user')::boolean then raise exception 'Wrong job'; end if;
  if public.app_mail_claim() is not null then raise exception 'Job claimed twice'; end if;
  if (select status from public.user_access_invitations where id=i)<>'sending' then raise exception 'Premature delivery'; end if;
  blocked:=false;
  begin perform public.app_mail_ack(i,gen_random_uuid(),true); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Invalid lease accepted'; end if;
  perform public.app_mail_ack(i,(q->>'lease')::uuid,true);
  perform public.app_mail_ack(i,(q->>'lease')::uuid,true);
  if (select status from public.user_access_invitations where id=i)<>'sent' then raise exception 'Missing delivery'; end if;
  if (select aprovado from public.user_profiles where id=u) then raise exception 'Queue granted access'; end if;
  update public.user_access_invitations set created_at=now()-interval '2 minutes' where id=i;
  perform public.app_invite_prepare(j,a,'queue-person@example.test','Test','{"capex":"read"}');
  perform public.app_mail_enqueue(j,a);
  perform public.app_invite_revoke(j,a);
  if public.app_mail_claim() is not null then raise exception 'Revoked invitation sent'; end if;
  if (select state from public.user_access_mail_queue where id=j)<>'canceled' then raise exception 'Revoked job not canceled'; end if;
  update public.user_access_invitations set created_at=now()-interval '2 minutes' where id=j;
  j:=gen_random_uuid();
  perform public.app_invite_prepare(j,a,'queue-person@example.test','Test','{"capex":"read"}');
  perform public.app_mail_enqueue(j,a);q:=public.app_mail_claim();
  update public.user_access_mail_queue set claimed_at=now()-interval '6 minutes' where id=j;
  if public.app_mail_claim() is not null then raise exception 'Uncertain job retried'; end if;
  if (select status from public.user_access_invitations where id=j)<>'failed' then raise exception 'Uncertain job not surfaced'; end if;
  perform public.app_mail_heartbeat(100);
  if not(public.app_mail_status()->>'ready')::boolean then raise exception 'Healthy sender not ready'; end if;
  perform public.app_mail_heartbeat(0);
  if(public.app_mail_status()->>'ready')::boolean then raise exception 'Empty quota ready'; end if;
end $$;
