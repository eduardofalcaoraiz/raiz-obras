alter table public.obras
  add column if not exists fases_obra jsonb not null default '{"versao":1,"atualizado_em":"","fases":[]}'::jsonb;

comment on column public.obras.fases_obra is
  'Checklist operacional das fases da obra, com status dos itens e documentos vinculados no Supabase Storage.';
