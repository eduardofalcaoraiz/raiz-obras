-- Garante metadados de criação/atualização usados pela tela de CAPEX.
alter table public.capex_itens
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.capex_itens
set created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, created_at, now())
where created_at is null
   or updated_at is null;
