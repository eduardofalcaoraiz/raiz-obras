-- Small independent queues keep pending records from starving behind payments.
create table if not exists public.zeev_attachment_dispatches (
  id bigint generated always as identity primary key,
  target text not null check (target in ('payments','pending','capex')),
  request_id bigint,
  requested_at timestamptz not null default now()
);
alter table public.zeev_attachment_dispatches enable row level security;
revoke all on public.zeev_attachment_dispatches from public,anon,authenticated;
grant select on public.zeev_attachment_dispatches to service_role;

create or replace function public.dispatch_zeev_attachments(p_target text)
returns bigint language plpgsql security definer set search_path=pg_catalog,public
as $$
declare v_secret text; v_request bigint;
begin
  if p_target not in ('payments','pending','capex') then
    raise exception 'Invalid attachment target';
  end if;
  perform pg_advisory_xact_lock(hashtext('zeev-attachments-'||p_target));
  if exists(select 1 from public.zeev_attachment_dispatches
    where target=p_target and requested_at>now()-interval '9 minutes') then return null; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets
    where name='zeev_db_cron_secret';
  if v_secret is null then raise exception 'Missing cloud sync secret'; end if;
  select net.http_post(
    url:='https://hjccxfznojjosvanwztv.supabase.co/functions/v1/zeev-capex-sync',
    headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',v_secret),
    body:=jsonb_build_object('mode','backfill-docs','limit',1,'fileLimit',20,
      'refresh',true,'forceEdge',true,'staleHours',8,
      'includePayments',p_target='payments','includePending',p_target='pending',
      'includeCapex',p_target='capex'),
    timeout_milliseconds:=120000
  ) into v_request;
  insert into public.zeev_attachment_dispatches(target,request_id) values(p_target,v_request);
  return v_request;
end $$;
revoke all on function public.dispatch_zeev_attachments(text) from public,anon,authenticated;
grant execute on function public.dispatch_zeev_attachments(text) to service_role;

select cron.schedule('raiz-attachments-payments','*/10 * * * *',
  $$select public.dispatch_zeev_attachments('payments')$$);
select cron.schedule('raiz-attachments-pending','3-59/10 * * * *',
  $$select public.dispatch_zeev_attachments('pending')$$);
select cron.schedule('raiz-attachments-capex','6-59/10 * * * *',
  $$select public.dispatch_zeev_attachments('capex')$$);
