create table if not exists public.real_estate_imoveis (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  unidade_ocupante text not null default '',
  marca text not null default 'RAIZ',
  endereco text not null default '',
  status text not null default 'Ativo',
  modalidade text not null default 'Locacao comum',
  revisao_pendente boolean not null default false,
  contrato_numero text not null default '',
  area_m2 numeric not null default 0,
  locador text not null default '',
  locataria text not null default '',
  cnpj_locataria text not null default '',
  centro_custo text not null default '',
  contrato_inicio date,
  contrato_fim date,
  valor_aluguel numeric not null default 0,
  investimento_locador numeric not null default 0,
  investidores jsonb not null default '[]'::jsonb,
  indice_reajuste text not null default '',
  data_reajuste date,
  garantia text not null default '',
  multa_aviso text not null default '',
  contrato_docs jsonb not null default '[]'::jsonb,
  obrigacoes jsonb not null default '[]'::jsonb,
  aditivos jsonb not null default '[]'::jsonb,
  devolucao jsonb not null default '{"status":"Sem devolucao prevista","previsao":"","valor_estimado":0,"observacoes":"","trs":[],"docs":[]}'::jsonb,
  observacoes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.real_estate_imoveis
  add column if not exists modalidade text not null default 'Locacao comum',
  add column if not exists revisao_pendente boolean not null default false,
  add column if not exists investimento_locador numeric not null default 0,
  add column if not exists investidores jsonb not null default '[]'::jsonb;

create index if not exists real_estate_imoveis_status_idx on public.real_estate_imoveis(status);
create index if not exists real_estate_imoveis_nome_idx on public.real_estate_imoveis(nome);
create index if not exists real_estate_imoveis_modalidade_idx on public.real_estate_imoveis(modalidade);
create index if not exists real_estate_imoveis_revisao_idx on public.real_estate_imoveis(revisao_pendente);
create index if not exists real_estate_imoveis_devolucao_gin_idx on public.real_estate_imoveis using gin(devolucao);
create index if not exists real_estate_imoveis_obrigacoes_gin_idx on public.real_estate_imoveis using gin(obrigacoes);

alter table public.real_estate_imoveis enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'real_estate_imoveis'
      and policyname = 'real_estate_imoveis_select_authenticated'
  ) then
    create policy real_estate_imoveis_select_authenticated
      on public.real_estate_imoveis
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'real_estate_imoveis'
      and policyname = 'real_estate_imoveis_write_authenticated'
  ) then
    create policy real_estate_imoveis_write_authenticated
      on public.real_estate_imoveis
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

comment on table public.real_estate_imoveis is
  'Cadastro independente de Real Estate: contratos de locacao, obrigacoes, aditivos, anexos e devolucao/restituicao de imoveis.';
