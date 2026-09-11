-- Additive evidence store. Source history is not an accounts-payable balance.
alter table public.real_estate_imoveis
  add column if not exists fonte_chave text,
  add column if not exists fonte_url text not null default '',
  add column if not exists pasta_url text not null default '';
create unique index if not exists real_estate_imoveis_fonte_chave_uidx
  on public.real_estate_imoveis(fonte_chave) where fonte_chave is not null and fonte_chave <> '';

create table if not exists public.real_estate_documentos (
  id uuid primary key default gen_random_uuid(),
  fonte_chave text not null unique,
  imovel_ids uuid[] not null default '{}',
  sublocacao_ids uuid[] not null default '{}',
  nome text not null,
  tipo text not null default 'Documento',
  url text not null check (url ~ '^https://'),
  pasta_url text not null default '',
  contexto text not null default '',
  fonte_url text not null default '',
  observacoes text not null default '',
  vinculo_revisar boolean not null default true,
  busca text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.real_estate_lancamentos (
  id uuid primary key default gen_random_uuid(),
  fonte_chave text not null unique,
  imovel_id uuid references public.real_estate_imoveis(id) on delete set null,
  sublocacao_id uuid references public.real_estate_sublocacoes(id) on delete set null,
  tipo text not null,
  periodo text not null,
  ano integer not null check (ano between 1990 and 2100),
  valor numeric(16,2),
  ticket_raiz text not null default '',
  referencia text not null default '',
  contraparte text not null default '',
  unidade text not null default '',
  endereco text not null default '',
  inscricao text not null default '',
  vencimento date,
  data_pagamento date,
  status_fonte text not null default 'Nao informado',
  fonte_nome text not null,
  fonte_url text not null check (fonte_url ~ '^https://'),
  observacoes text not null default '',
  busca text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists re_doc_imovel_idx on public.real_estate_documentos using gin(imovel_ids);
create index if not exists re_doc_subloc_idx on public.real_estate_documentos using gin(sublocacao_ids);
create index if not exists re_lanc_imovel_idx on public.real_estate_lancamentos(imovel_id,ano,periodo);
create index if not exists re_lanc_subloc_idx on public.real_estate_lancamentos(sublocacao_id,ano,periodo);
create index if not exists re_lanc_ticket_idx on public.real_estate_lancamentos(ticket_raiz);
create index if not exists re_lanc_ano_idx on public.real_estate_lancamentos(ano);
alter table public.real_estate_documentos enable row level security;
alter table public.real_estate_lancamentos enable row level security;
revoke all on public.real_estate_documentos,public.real_estate_lancamentos from anon;
revoke all on public.real_estate_documentos,public.real_estate_lancamentos from authenticated;
grant select on public.real_estate_documentos,public.real_estate_lancamentos to authenticated;
grant all on public.real_estate_documentos,public.real_estate_lancamentos to service_role;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='real_estate_documentos' and policyname='re_documentos_read') then
    create policy re_documentos_read on public.real_estate_documentos for select to authenticated using(true);
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='real_estate_lancamentos' and policyname='re_lancamentos_read') then
    create policy re_lancamentos_read on public.real_estate_lancamentos for select to authenticated using(true);
  end if;
end $$;
comment on table public.real_estate_lancamentos is 'Historico de fontes identificadas. Lancado/baixado na planilha nao equivale a comprovante bancario conferido. Valores sem fonte numerica permanecem nulos.';
notify pgrst, 'reload schema';
