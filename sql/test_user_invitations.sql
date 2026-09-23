-- Run inside a transaction and always roll back: no real users or email sends.
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at,encrypted_password,aud,role) values
 ('a1111111-1111-4111-8111-111111111111','admin-invite-test@example.test','{}',now(),'test','authenticated','authenticated'),
 ('b1111111-1111-4111-8111-111111111111','recipient-invite-test@example.test','{}',now(),'','authenticated','authenticated'),
 ('c1111111-1111-4111-8111-111111111111','other-invite-test@example.test','{}',now(),'test','authenticated','authenticated');
update public.user_profiles set role='admin',aprovado=true where id='a1111111-1111-4111-8111-111111111111';
do $$
declare a uuid:='a1111111-1111-4111-8111-111111111111'; u uuid:='b1111111-1111-4111-8111-111111111111'; other_u uuid:='c1111111-1111-4111-8111-111111111111'; i uuid:=gen_random_uuid(); j uuid:=gen_random_uuid(); k uuid:=gen_random_uuid(); out jsonb; blocked boolean; rev bigint;
begin
  if has_function_privilege('authenticated','public.app_invite_accept(uuid,uuid)','execute') or has_function_privilege('anon','public.app_invite_prepare(uuid,uuid,text,text,jsonb)','execute') then raise exception 'Browser has privileged RPC access'; end if;
  blocked:=false;
  begin perform public.app_invite_prepare(i,u,'recipient-invite-test@example.test','Test','{"capex":"read"}'); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Non-admin invitation accepted'; end if;
  out:=public.app_invite_prepare(i,a,'recipient-invite-test@example.test','Test','{"capex":"read","realestate_locacoes":"edit"}');
  if out->>'status'<>'sending' or not (out->>'existing_user')::boolean then raise exception 'Prepare failed'; end if;
  if (select aprovado from public.user_profiles where id=u) then raise exception 'Prepare approved user'; end if;
  out:=public.app_invite_prepare(i,a,'recipient-invite-test@example.test','Test','{"capex":"read","realestate_locacoes":"edit"}');
  if not (out->>'duplicate')::boolean then raise exception 'Idempotency failed'; end if;
  blocked:=false;
  begin perform public.app_invite_accept(i,u); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Unsent invitation accepted'; end if;
  perform public.app_invite_delivery(i,a,false,'test');
  blocked:=false;
  begin perform public.app_invite_accept(i,u); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Failed invitation accepted'; end if;
  update public.user_access_invitations set created_at=now()-interval '2 minutes' where id=i;
  perform public.app_invite_prepare(j,a,'recipient-invite-test@example.test','Test','{"capex":"read"}');
  perform public.app_invite_delivery(j,a,true,null);
  blocked:=false;
  begin perform public.app_invite_accept(j,other_u); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Wrong recipient accepted'; end if;
  if (select expires_at is not null from public.user_access_invitations where id=j) then raise exception 'New invitation has expiration'; end if;
  update public.user_profiles set access_config='{}' where id=u;
  blocked:=false;
  begin perform public.app_invite_accept(j,u); exception when serialization_failure then blocked:=true; end;
  if not blocked then raise exception 'Concurrent profile edit overwritten'; end if;
  update public.user_access_invitations set created_at=now()-interval '2 minutes' where id=j;
  perform public.app_invite_prepare(k,a,'recipient-invite-test@example.test','Test','{"capex":"read","realestate_locacoes":"edit"}');
  if (select status from public.user_access_invitations where id=j)<>'revoked' then raise exception 'Old link not revoked'; end if;
  perform public.app_invite_delivery(k,a,true,null);
  update public.user_access_invitations set created_at=now()-interval '2 years',expires_at=now()-interval '1 year' where id=k;
  out:=public.app_invite_accept(k,u);
  if not (out->>'accepted')::boolean or not (out->>'needs_password')::boolean then raise exception 'Acceptance failed'; end if;
  if not exists(select 1 from public.user_profiles where id=u and aprovado and role='leitor' and access_config='{"capex":"read","realestate_locacoes":"edit"}') then raise exception 'Wrong grants after acceptance'; end if;
  select access_revision into rev from public.user_profiles where id=u;
  perform public.app_invite_accept(k,u);
  if (select access_revision from public.user_profiles where id=u)<>rev then raise exception 'Accept not idempotent'; end if;
  update public.user_profiles set aprovado=false where id=u;
  perform public.app_invite_accept(k,u);
  if (select aprovado from public.user_profiles where id=u) then raise exception 'Consumed invite restored revoked access'; end if;
  if not exists(select 1 from public.user_access_audit where actor_id=a and user_id=u and after_state->>'aprovado'='true') then raise exception 'Missing administrator audit'; end if;
end $$;
select set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.user_access_invitations) then raise exception 'Recipient can enumerate invitations'; end if;
 if public.app_can('capex') then raise exception 'Revoked profile retains module access'; end if;
end $$;
reset role;
