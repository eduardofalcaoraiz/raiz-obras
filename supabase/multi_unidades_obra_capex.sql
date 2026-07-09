alter table public.obras
  add column if not exists subtitulo_obra text,
  add column if not exists unidades_obra jsonb not null default '[]'::jsonb;

comment on column public.obras.subtitulo_obra is
  'Subtitulo opcional para diferenciar obras vinculadas a uma ou mais unidades escolares.';

comment on column public.obras.unidades_obra is
  'Lista ordenada das unidades escolares vinculadas a obra. A primeira e a principal para compatibilidade.';

alter table public.capex_itens
  add column if not exists unidades_json jsonb not null default '[]'::jsonb;

comment on column public.capex_itens.unidades_json is
  'Lista de unidades escolares envolvidas no pedido de CAPEX. A coluna unidade permanece como unidade principal para saldos e dashboards.';
