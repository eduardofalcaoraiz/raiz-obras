create table if not exists public.capex_saldos (
  id bigserial primary key,
  ano integer not null,
  unidade text not null,
  marca text,
  valor numeric not null default 0,
  observacoes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint capex_saldos_unidade_ano_unique unique (ano, unidade)
);

alter table public.capex_saldos enable row level security;

drop policy if exists "capex_saldos_select_authenticated" on public.capex_saldos;
create policy "capex_saldos_select_authenticated"
  on public.capex_saldos for select
  to authenticated
  using (true);

drop policy if exists "capex_saldos_insert_authenticated" on public.capex_saldos;
create policy "capex_saldos_insert_authenticated"
  on public.capex_saldos for insert
  to authenticated
  with check (true);

drop policy if exists "capex_saldos_update_authenticated" on public.capex_saldos;
create policy "capex_saldos_update_authenticated"
  on public.capex_saldos for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "capex_saldos_delete_authenticated" on public.capex_saldos;
create policy "capex_saldos_delete_authenticated"
  on public.capex_saldos for delete
  to authenticated
  using (true);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists capex_saldos_set_updated_at on public.capex_saldos;
create trigger capex_saldos_set_updated_at
before update on public.capex_saldos
for each row
execute function public.set_updated_at();
