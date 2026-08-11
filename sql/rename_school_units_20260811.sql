begin;

create or replace function pg_temp.canonical_school_names(value text)
returns text
language sql
immutable
strict
as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          value,
          U&'(ESCOLA[[:space:]]+)?S(A|\00C1)[[:space:]]+PEREIRA([[:space:]]+S[.]?A[.]?)?[[:space:]]+CAPISTRANO',
          U&'S\00E1 Pereira - Pereirinha',
          'gi'
        ),
        'GLOBAL[[:space:]]+TREE[[:space:]]*[-]?[[:space:]]*BOTAFOGO([[:space:]]+E[[:space:]]+CUBO[[:space:]]+LUCENA)?([[:space:]]*[(]ANTIGA[[:space:]]+BOM[[:space:]]+TEMPO[)])?',
        'Cubo Kids',
        'gi'
      ),
      'CUBO([[:space:]]+GLOBAL[[:space:]]+SCHOOL)?[[:space:]]+BOTA(FOGO|GOFO)[[:space:]]*[-]?[[:space:]]*LUCENA',
      'Cubo Kids',
      'gi'
    ),
    'CUBO[[:space:]]+LUCENA',
    'Cubo Kids',
    'gi'
  )
$$;

do $guard$
begin
  if exists (
    select 1 from public.unidades
    where nome = U&'S\00E1 Pereira - Pereirinha' and id <> 'u86'
  ) then
    raise exception 'Ja existe outra unidade com o nome Sa Pereira - Pereirinha';
  end if;
  if exists (
    select 1 from public.unidades
    where nome = 'Cubo Kids' and id <> 'u58'
  ) then
    raise exception 'Ja existe outra unidade com o nome Cubo Kids';
  end if;
end
$guard$;

update public.unidades
set nome = U&'S\00E1 Pereira - Pereirinha'
where id = 'u86'
   or pg_temp.canonical_school_names(nome) = U&'S\00E1 Pereira - Pereirinha';

update public.capex_itens
set unidade = U&'S\00E1 Pereira - Pereirinha',
    updated_at = now()
where pg_temp.canonical_school_names(unidade) = U&'S\00E1 Pereira - Pereirinha'
  and unidade is distinct from U&'S\00E1 Pereira - Pereirinha';

update public.capex_saldos
set unidade = U&'S\00E1 Pereira - Pereirinha',
    updated_at = now()
where pg_temp.canonical_school_names(unidade) = U&'S\00E1 Pereira - Pereirinha'
  and unidade is distinct from U&'S\00E1 Pereira - Pereirinha';

update public.capex_zeev_solicitacoes
set unidade = U&'S\00E1 Pereira - Pereirinha',
    updated_at = now()
where pg_temp.canonical_school_names(unidade) = U&'S\00E1 Pereira - Pereirinha'
  and unidade is distinct from U&'S\00E1 Pereira - Pereirinha';

update public.documentos_unidade
set unidade_id = 'u58'
where unidade_id in ('u91', 'u103');

update public.unidades
set nome = 'Cubo Kids',
    marca = 'CUBO',
    endereco = U&'Rua Bar\00E3o de Lucena, 103 - Botafogo, Rio de Janeiro - RJ, 22.260-020',
    obra_id = coalesce(obra_id, 19)
where id = 'u58';

update public.capex_itens
set unidade = 'Cubo Kids',
    marca = 'CUBO',
    updated_at = now()
where pg_temp.canonical_school_names(unidade) = 'Cubo Kids'
  and unidade is distinct from 'Cubo Kids';

update public.capex_saldos
set unidade = 'Cubo Kids',
    marca = 'CUBO',
    updated_at = now()
where pg_temp.canonical_school_names(unidade) = 'Cubo Kids'
  and unidade is distinct from 'Cubo Kids';

update public.capex_zeev_solicitacoes
set unidade = 'Cubo Kids',
    marca = 'CUBO',
    updated_at = now()
where pg_temp.canonical_school_names(unidade) = 'Cubo Kids'
  and unidade is distinct from 'Cubo Kids';

update public.obras
set nome = 'Cubo Kids',
    marca = 'CUBO',
    endereco_obra = U&'Rua Bar\00E3o de Lucena, 103 - Botafogo, Rio de Janeiro - RJ, 22.260-020',
    subtitulo_obra = 'Cubo Kids',
    unidades_obra = jsonb_build_array(jsonb_build_object(
      'id', 'u58',
      'nome', 'Cubo Kids',
      'marca', 'CUBO',
      'principal', true
    ))
where id = 19
   or pg_temp.canonical_school_names(nome) = 'Cubo Kids'
   or pg_temp.canonical_school_names(unidades_obra::text) is distinct from unidades_obra::text;

update public.pagamentos
set pagn = 'Cubo Kids'
where obra_id = 19
   or pg_temp.canonical_school_names(pagn) = 'Cubo Kids';

update public.capex_itens
set ticket_raiz_dados = pg_temp.canonical_school_names(ticket_raiz_dados::text)::jsonb,
    updated_at = now()
where ticket_raiz_dados is not null
  and pg_temp.canonical_school_names(ticket_raiz_dados::text) is distinct from ticket_raiz_dados::text;

update public.capex_itens
set unidades_json = pg_temp.canonical_school_names(unidades_json::text)::jsonb,
    updated_at = now()
where unidades_json is not null
  and pg_temp.canonical_school_names(unidades_json::text) is distinct from unidades_json::text;

update public.capex_saldos
set observacoes = pg_temp.canonical_school_names(observacoes),
    updated_at = now()
where observacoes is not null
  and pg_temp.canonical_school_names(observacoes) is distinct from observacoes;

update public.capex_zeev_solicitacoes
set pedido = pg_temp.canonical_school_names(pedido),
    updated_at = now()
where pedido is not null
  and pg_temp.canonical_school_names(pedido) is distinct from pedido;

update public.capex_zeev_solicitacoes
set campos_extraidos = pg_temp.canonical_school_names(campos_extraidos::text)::jsonb,
    updated_at = now()
where campos_extraidos is not null
  and pg_temp.canonical_school_names(campos_extraidos::text) is distinct from campos_extraidos::text;

update public.capex_zeev_solicitacoes
set raw_fields = pg_temp.canonical_school_names(raw_fields::text)::jsonb,
    updated_at = now()
where raw_fields is not null
  and pg_temp.canonical_school_names(raw_fields::text) is distinct from raw_fields::text;

delete from public.unidades where id in ('u91', 'u103');

do $verify$
declare
  cubo_saldo numeric;
begin
  if not exists (
    select 1 from public.unidades
    where id = 'u86' and nome = U&'S\00E1 Pereira - Pereirinha'
  ) then
    raise exception 'Cadastro da Pereirinha nao foi renomeado';
  end if;
  if not exists (
    select 1 from public.unidades
    where id = 'u58'
      and nome = 'Cubo Kids'
      and marca = 'CUBO'
      and endereco = U&'Rua Bar\00E3o de Lucena, 103 - Botafogo, Rio de Janeiro - RJ, 22.260-020'
  ) then
    raise exception 'Cadastro canonico Cubo Kids nao foi consolidado';
  end if;
  if exists (select 1 from public.unidades where id in ('u91', 'u103')) then
    raise exception 'Cadastros duplicados do Cubo Kids ainda existem';
  end if;
  select valor into cubo_saldo
  from public.capex_saldos
  where ano = 2026 and unidade = 'Cubo Kids';
  if cubo_saldo is distinct from 78080 then
    raise exception 'Saldo CAPEX 2026 do Cubo Kids diverge de 78080: %', cubo_saldo;
  end if;
  if exists (
    select 1 from public.capex_itens
    where unidade <> pg_temp.canonical_school_names(unidade)
  ) then
    raise exception 'Ainda existem nomes antigos em capex_itens.unidade';
  end if;
  if exists (
    select 1 from public.capex_saldos
    where unidade <> pg_temp.canonical_school_names(unidade)
  ) then
    raise exception 'Ainda existem nomes antigos em capex_saldos.unidade';
  end if;
  if not exists (
    select 1 from public.obras
    where id = 19 and nome = 'Cubo Kids'
      and unidades_obra = jsonb_build_array(jsonb_build_object(
        'id', 'u58', 'nome', 'Cubo Kids', 'marca', 'CUBO', 'principal', true
      ))
  ) then
    raise exception 'Obra do Cubo Kids nao foi consolidada';
  end if;
  if exists (
    select 1 from public.pagamentos
    where obra_id = 19 and pagn is distinct from 'Cubo Kids'
  ) then
    raise exception 'Ainda existem pagamentos da obra 19 com nome antigo';
  end if;
end
$verify$;

commit;
