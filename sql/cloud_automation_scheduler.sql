-- The secret is provisioned separately in Vault. Never put credentials here.
create table if not exists public.cloud_automation_dispatches (
  task text not null check(task in ('capex','real-estate','storage')),
  slot timestamptz not null,
  request_id bigint,
  state text not null default 'queued' check(state in ('queued','accepted','http_error','unknown')),
  http_status integer,
  requested_at timestamptz not null default now(),
  checked_at timestamptz,
  primary key(task,slot)
);
alter table public.cloud_automation_dispatches enable row level security;
revoke all on public.cloud_automation_dispatches from public,anon,authenticated;
grant select on public.cloud_automation_dispatches to service_role;

create or replace function public.dispatch_cloud_automation(p_task text)
returns bigint language plpgsql security definer set search_path=pg_catalog,public
as $$
declare
  v_workflow text; v_inputs jsonb; v_slot timestamptz; v_token text;
  v_request bigint; v_inserted integer;
begin
  case p_task
    when 'capex' then
      v_workflow := 'zeev-capex-sync.yml';
      v_inputs := '{"mode":"incremental","scheduled_light":true}'::jsonb;
      v_slot := date_trunc('hour',now() at time zone 'UTC') at time zone 'UTC';
    when 'real-estate' then
      v_workflow := 'zeev-real-estate-sync.yml';
      v_inputs := '{"links_only":false}'::jsonb;
      v_slot := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
    when 'storage' then
      v_workflow := 'supabase-storage-maintenance.yml';
      v_inputs := '{"mode":"metadata-only"}'::jsonb;
      v_slot := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
    else raise exception 'Unsupported automation task';
  end case;
  insert into public.cloud_automation_dispatches(task,slot) values(p_task,v_slot)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return null; -- At most one dispatch per hour/day, including manual verification.
  end if;
  select decrypted_secret into v_token from vault.decrypted_secrets
  where name='raiz_github_actions_dispatch';
  if v_token is null then raise exception 'Cloud dispatch credential is not configured'; end if;
  select net.http_post(
    url := 'https://api.github.com/repos/eduardofalcaoraiz/raiz-obras/actions/workflows/' || v_workflow || '/dispatches',
    headers := jsonb_build_object('Authorization','Bearer ' || v_token,
      'Accept','application/vnd.github+json','X-GitHub-Api-Version','2022-11-28',
      'Content-Type','application/json','User-Agent','Raiz-Cloud-Scheduler'),
    body := jsonb_build_object('ref','main','inputs',v_inputs),
    timeout_milliseconds := 15000
  ) into v_request;
  update public.cloud_automation_dispatches set request_id=v_request
  where task=p_task and slot=v_slot;
  return v_request;
end $$;
revoke all on function public.dispatch_cloud_automation(text) from public,anon,authenticated;
grant execute on function public.dispatch_cloud_automation(text) to service_role;

create or replace function public.collect_cloud_automation_receipts()
returns integer language plpgsql security definer set search_path=pg_catalog,public
as $$
declare v_count integer;
begin
  update public.cloud_automation_dispatches d
  set state=case when r.status_code=204 then 'accepted' else 'http_error' end,
      http_status=r.status_code,checked_at=now()
  from net._http_response r
  where d.state='queued' and r.id=d.request_id;
  get diagnostics v_count=row_count;
  update public.cloud_automation_dispatches
  set state='unknown',checked_at=now()
  where state='queued' and requested_at < now()-interval '10 minutes';
  -- An accepted dispatch is NOT evidence of successful workflow completion.
  -- Unknown responses are not retried blindly, avoiding duplicate executions.
  return v_count;
end $$;
revoke all on function public.collect_cloud_automation_receipts() from public,anon,authenticated;
grant execute on function public.collect_cloud_automation_receipts() to service_role;
