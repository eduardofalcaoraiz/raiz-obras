create table if not exists public.capex_zeev_solicitacoes (
  id bigserial primary key,
  zeev_instance_id bigint not null unique,
  zeev_uid uuid,
  flow_id integer,
  flow_name text,
  flow_version integer,
  request_name text,
  ticket_link text,
  confirmation_code text,
  start_date_time timestamptz,
  end_date_time timestamptz,
  last_finished_task_date_time timestamptz,
  active boolean,
  flow_result text,
  capex_field_name text,
  capex_field_value text,
  requester_name text,
  requester_email text,
  requester_username text,
  requester_team text,
  etapa_atual text,
  passou_conferir_entrega boolean not null default false,
  pronto_valor_final boolean not null default false,
  valor numeric,
  valor_final numeric,
  valor_status text not null default 'nao_encontrado',
  unidade text,
  marca text,
  pedido text,
  categoria_capex text,
  fonte text not null default 'UNIDADE',
  setor text not null default 'COMPRAS',
  situacao_sugerida text not null default 'Em Andamento',
  realizado_sugerido boolean not null default false,
  raw_fields jsonb not null default '[]'::jsonb,
  raw_instance jsonb not null default '{}'::jsonb,
  raw_tasks jsonb not null default '[]'::jsonb,
  status text not null default 'pendente',
  capex_item_id integer references public.capex_itens(id) on delete set null,
  aprovado_por text,
  aprovado_em timestamptz,
  ignorado_por text,
  ignorado_em timestamptz,
  email_notified_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint capex_zeev_status_check check (status in ('pendente','aprovado','ignorado','erro')),
  constraint capex_zeev_valor_status_check check (valor_status in ('estimado','em_aprovacao','final','nao_encontrado'))
);

alter table public.capex_zeev_solicitacoes
  add column if not exists confirmation_code text,
  add column if not exists email_notified_at timestamptz,
  add column if not exists itens_json jsonb not null default '[]'::jsonb,
  add column if not exists pagamento_json jsonb not null default '{}'::jsonb,
  add column if not exists campos_extraidos jsonb not null default '{}'::jsonb,
  add column if not exists enrichment_errors jsonb not null default '[]'::jsonb;

alter table public.capex_zeev_solicitacoes
  drop constraint if exists capex_zeev_valor_status_check;

alter table public.capex_zeev_solicitacoes
  add constraint capex_zeev_valor_status_check
  check (valor_status in ('estimado','em_aprovacao','final','nao_encontrado'));

create index if not exists capex_zeev_solicitacoes_status_idx
  on public.capex_zeev_solicitacoes(status, start_date_time desc);

create index if not exists capex_zeev_solicitacoes_flow_idx
  on public.capex_zeev_solicitacoes(flow_id, start_date_time desc);

create table if not exists public.zeev_sync_state (
  id text primary key,
  last_success_at timestamptz,
  last_start_date timestamptz,
  last_end_date timestamptz,
  last_error text,
  last_run_found integer not null default 0,
  last_run_new integer not null default 0,
  last_run_updated integer not null default 0,
  running boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.capex_itens
  add column if not exists ticket_raiz_url text,
  add column if not exists ticket_raiz_instance_id bigint,
  add column if not exists origem text,
  add column if not exists ticket_raiz_dados jsonb;

alter table public.capex_zeev_solicitacoes enable row level security;
alter table public.zeev_sync_state enable row level security;

drop policy if exists "capex_zeev_select_authenticated" on public.capex_zeev_solicitacoes;
create policy "capex_zeev_select_authenticated"
  on public.capex_zeev_solicitacoes for select
  to authenticated
  using (true);

drop policy if exists "capex_zeev_update_authenticated" on public.capex_zeev_solicitacoes;
create policy "capex_zeev_update_authenticated"
  on public.capex_zeev_solicitacoes for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "zeev_sync_state_select_authenticated" on public.zeev_sync_state;
create policy "zeev_sync_state_select_authenticated"
  on public.zeev_sync_state for select
  to authenticated
  using (true);

drop trigger if exists capex_zeev_solicitacoes_set_updated_at on public.capex_zeev_solicitacoes;
create trigger capex_zeev_solicitacoes_set_updated_at
before update on public.capex_zeev_solicitacoes
for each row
execute function public.set_updated_at();

drop trigger if exists zeev_sync_state_set_updated_at on public.zeev_sync_state;
create trigger zeev_sync_state_set_updated_at
before update on public.zeev_sync_state
for each row
execute function public.set_updated_at();
