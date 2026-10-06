begin;

create table if not exists public.obra_compras (
  id bigint generated always as identity primary key,
  solicitacao_id bigint not null unique references public.capex_zeev_solicitacoes(id),
  ticket_raiz bigint not null unique,
  obra_id integer not null references public.obras(id),
  escopo text not null check (escopo in ('obra','extra')),
  fornecedor text not null default '',
  descricao text not null check (length(trim(descricao))>0),
  valor_estimado numeric(16,2) check (valor_estimado>=0),
  registrado_por uuid not null references auth.users(id),
  registrado_em timestamptz not null default now()
);
alter table public.obra_compras enable row level security;
revoke all on public.obra_compras from public,anon,authenticated;
grant select on public.obra_compras to authenticated;
grant all on public.obra_compras to service_role;
drop policy if exists obra_compras_read on public.obra_compras;
create policy obra_compras_read on public.obra_compras for select to authenticated
  using (public.app_obra_access(obra_id));

create or replace function public.register_obra_compra(
  p_solicitacao_id bigint,p_obra_id integer,p_escopo text,
  p_fornecedor text,p_descricao text,p_valor numeric,p_aprovar boolean default true
) returns public.obra_compras
language plpgsql security definer set search_path=public,pg_temp as $$
declare z public.capex_zeev_solicitacoes; r public.obra_compras;
begin
  if auth.uid() is null or not public.app_can('registros','edit')
    or not public.app_obra_access(p_obra_id,'edit') then
    raise exception 'Sem permissao para registrar compras nesta obra.' using errcode='42501';
  end if;
  if p_escopo is null or p_escopo not in ('obra','extra') or nullif(trim(p_descricao),'') is null
    or p_valor<0 or p_valor::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Confira a obra, o escopo, a descricao e o valor da compra.';
  end if;
  select * into z from public.capex_zeev_solicitacoes where id=p_solicitacao_id for update;
  if not found then raise exception 'Ticket nao encontrado.'; end if;
  if coalesce(z.flow_id,0) in (110,151,152,220,263,275,299)
    or not (coalesce(z.flow_id,0) in (102,300,365)
      or lower(coalesce(z.flow_name,z.request_name,'')) like '%compra%') then
    raise exception 'Este ticket nao e uma solicitacao de compra.';
  end if;
  select * into r from public.obra_compras where solicitacao_id=z.id;
  if found then
    if r.obra_id=p_obra_id and r.escopo=p_escopo then return r; end if;
    raise exception 'Compra ja registrada em outra obra ou escopo. Revise o vinculo existente.';
  end if;
  if p_aprovar then
    if z.status<>'pendente' or z.capex_item_id is not null then
      raise exception 'Ticket ja tratado. Atualize a fila antes de continuar.';
    end if;
  elsif z.capex_item_id is null or not public.app_can('capex','edit') then
    raise exception 'Vinculo CAPEX nao confirmado.';
  end if;
  insert into public.obra_compras(solicitacao_id,ticket_raiz,obra_id,escopo,fornecedor,descricao,valor_estimado,registrado_por)
    values(z.id,z.zeev_instance_id,p_obra_id,p_escopo,coalesce(trim(p_fornecedor),''),trim(p_descricao),p_valor,auth.uid())
    returning * into r;
  if p_aprovar then
    update public.capex_zeev_solicitacoes set status='aprovado',
      aprovado_por=coalesce(auth.jwt()->>'email',''),aprovado_em=now() where id=z.id;
  end if;
  return r;
end;
$$;
revoke all on function public.register_obra_compra(bigint,integer,text,text,text,numeric,boolean) from public,anon;
grant execute on function public.register_obra_compra(bigint,integer,text,text,text,numeric,boolean) to authenticated;

create or replace function public.obra_compra_documentos(p_solicitacao_id bigint) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',z.id,'zeev_instance_id',z.zeev_instance_id,
   'request_name',z.request_name,'pedido',c.descricao,'docs_json',z.docs_json)
 from public.obra_compras c join public.capex_zeev_solicitacoes z on z.id=c.solicitacao_id
 where c.solicitacao_id=p_solicitacao_id and auth.uid() is not null
   and public.app_obra_access(c.obra_id);
$$;
revoke all on function public.obra_compra_documentos(bigint) from public,anon;
grant execute on function public.obra_compra_documentos(bigint) to authenticated;
commit;
