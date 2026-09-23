-- Synthetic records only; run inside a transaction followed by rollback.
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at,encrypted_password,aud,role) values
 ('a3333333-3333-4333-8333-333333333333','permanent-admin@example.test','{}',now(),'test','authenticated','authenticated'),
 ('b3333333-3333-4333-8333-333333333333','permanent-person@example.test','{}',now(),'','authenticated','authenticated');
update public.user_profiles set role='admin',aprovado=true where id='a3333333-3333-4333-8333-333333333333';
do $$
declare a uuid:='a3333333-3333-4333-8333-333333333333'; u uuid:='b3333333-3333-4333-8333-333333333333'; i uuid:=gen_random_uuid(); l uuid:=gen_random_uuid(); blocked boolean; result jsonb;
begin
 if has_table_privilege('authenticated','public.user_access_invite_links','select') or has_function_privilege('anon','public.app_invite_link_open(uuid,text)','execute') then raise exception 'Token data exposed'; end if;
 perform public.app_invite_prepare(i,a,'permanent-person@example.test','Test','{"capex":"read"}');
 perform public.app_mail_enqueue(i,a);
 update public.user_access_mail_queue set state='processing',lease=l where id=i;
 blocked:=false;
 begin perform public.app_invite_link_save(i,gen_random_uuid(),repeat('a',64)); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Wrong lease saved secret'; end if;
 perform public.app_invite_link_save(i,l,repeat('a',64));
 blocked:=false;
 begin perform public.app_invite_link_open(i,repeat('a',64)); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Unsent link opened'; end if;
 perform public.app_mail_ack(i,l,true);
 update public.user_access_invitations set created_at=now()-interval '5 years',expires_at=now()-interval '4 years' where id=i;
 blocked:=false;
 begin perform public.app_invite_link_open(i,repeat('b',64)); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Wrong secret opened'; end if;
 result:=public.app_invite_link_open(i,repeat('a',64));
 if result->>'email'<>'permanent-person@example.test' then raise exception 'Wrong recipient'; end if;
 blocked:=false;
 begin perform public.app_invite_link_open(i,repeat('a',64)); exception when sqlstate 'P0429' then blocked:=true; end;
 if not blocked then raise exception 'Rate limit missing'; end if;
 update public.user_access_invite_links set last_opened_at=null where invitation_id=i;
 update public.user_profiles set access_config='{}' where id=u;
 blocked:=false;
 begin perform public.app_invite_link_open(i,repeat('a',64)); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Stale permissions opened'; end if;
 update public.user_access_invitations set expected_revision=(select access_revision from public.user_profiles where id=u) where id=i;
 perform public.app_invite_revoke(i,a);
 blocked:=false;
 begin perform public.app_invite_link_open(i,repeat('a',64)); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Revoked link opened'; end if;
 update public.user_access_invitations set status='sent' where id=i;
 perform public.app_invite_accept(i,u);
 blocked:=false;
 begin perform public.app_invite_link_open(i,repeat('a',64)); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Consumed link opened'; end if;
end $$;
