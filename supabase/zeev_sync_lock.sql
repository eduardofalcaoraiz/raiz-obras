-- Atomic lock used by the online Zeev CAPEX scheduler.
-- Prevents concurrent cron/manual dispatches from creating duplicated GitHub Actions runs.

create or replace function public.claim_zeev_sync_lock(
  p_id text default 'zeev-capex',
  p_ttl_minutes integer default 15,
  p_start timestamptz default null,
  p_end timestamptz default null
)
returns table (
  claimed boolean,
  running_since timestamptz,
  lock_ttl_minutes integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state public.zeev_sync_state%rowtype;
  v_ttl integer := greatest(coalesce(p_ttl_minutes, 15), 1);
begin
  insert into public.zeev_sync_state (
    id,
    running,
    last_error,
    last_start_date,
    last_end_date,
    updated_at
  )
  values (
    p_id,
    true,
    null,
    p_start,
    p_end,
    now()
  )
  on conflict (id) do nothing
  returning * into v_state;

  if found then
    return query select true, v_state.updated_at, v_ttl;
    return;
  end if;

  update public.zeev_sync_state
     set running = true,
         last_error = null,
         last_start_date = p_start,
         last_end_date = p_end,
         updated_at = now()
   where id = p_id
     and (
       running = false
       or updated_at < now() - make_interval(mins => v_ttl)
     )
  returning * into v_state;

  if found then
    return query select true, v_state.updated_at, v_ttl;
    return;
  end if;

  select * into v_state
    from public.zeev_sync_state
   where id = p_id;

  return query select false, v_state.updated_at, v_ttl;
end;
$$;

