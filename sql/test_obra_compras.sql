-- Run inside a transaction and roll back: no real approval is retained.
do $$
declare z bigint; o integer; r public.obra_compras; again public.obra_compras; before_count bigint;
begin
  perform set_config('request.jwt.claims','{"sub":"e56ab877-62a8-4f2c-9ef8-55ab93fd51b9","role":"authenticated","email":"test@example.test"}',true);
  select id into z from public.capex_zeev_solicitacoes where status='pendente' and capex_item_id is null
    and flow_id=365 and id not in(select solicitacao_id from public.obra_compras) limit 1;
  select id into o from public.obras limit 1;
  if z is null or o is null then raise exception 'Missing test fixture'; end if;
  select count(*) into before_count from public.pagamentos;
  r:=public.register_obra_compra(z,o,'extra','','Compra de teste',null,true);
  if r.escopo<>'extra' or r.valor_estimado is not null then raise exception 'Purchase data mismatch'; end if;
  if (select status from public.capex_zeev_solicitacoes where id=z)<>'aprovado' then raise exception 'Approval not atomic'; end if;
  if (select count(*) from public.pagamentos)<>before_count then raise exception 'Purchase generated payment'; end if;
  again:=public.register_obra_compra(z,o,'extra','','Compra de teste',null,true);
  if again.id<>r.id then raise exception 'Idempotency failed'; end if;
  begin
    perform public.register_obra_compra(z,o,'obra','','Other scope',null,true);
    raise exception 'Scope change accepted' using errcode='ZX001';
  exception when sqlstate 'P0001' then null;
  end;
  if public.obra_compra_documentos(z) is null then raise exception 'Documents missing for owner'; end if;
  perform set_config('request.jwt.claims','{}',true);
  if public.obra_compra_documentos(z) is not null then raise exception 'Anonymous documents exposed'; end if;
  begin
    perform public.register_obra_compra(z,o,'extra','','Unauthorized',null,true);
    raise exception 'Anonymous purchase accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
