-- Ticket snapshots complement source history; workflow completion is not proof of payment.
create table if not exists public.real_estate_tickets (
  ticket_raiz text primary key check(ticket_raiz ~ '^[0-9]{4,8}$'),
  imovel_ids uuid[] not null default '{}',
  sublocacao_ids uuid[] not null default '{}',
  descricao text not null default '',
  fornecedor text not null default '',
  cnpj_fornecedor text not null default '',
  centro_custo text not null default '',
  valor_total numeric(16,2),
  vencimento date,
  competencia text not null default '',
  status text not null default 'Nao confirmado',
  etapa text not null default '',
  financeiro boolean not null default false,
  ticket_url text not null check(ticket_url ~ '^https://'),
  anexos jsonb not null default '[]' check(jsonb_typeof(anexos)='array'),
  componentes jsonb not null default '[]' check(jsonb_typeof(componentes)='array'),
  vinculo_revisar boolean not null default true,
  observacoes text not null default '',
  sincronizado_em timestamptz not null default now()
);
create index if not exists real_estate_tickets_imovel_idx on public.real_estate_tickets using gin(imovel_ids);
create index if not exists real_estate_tickets_sub_idx on public.real_estate_tickets using gin(sublocacao_ids);
alter table public.real_estate_tickets enable row level security;
revoke all on public.real_estate_tickets from anon,authenticated;
grant select on public.real_estate_tickets to authenticated;
grant all on public.real_estate_tickets to service_role;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='real_estate_tickets' and policyname='real_estate_tickets_read') then
    create policy real_estate_tickets_read on public.real_estate_tickets for select to authenticated using(true);
  end if;
end $$;
comment on table public.real_estate_tickets is 'Consulta Zeev com proveniencia; anexos listados nao foram necessariamente conferidos e finalizacao do fluxo nao comprova pagamento.';
notify pgrst,'reload schema';
