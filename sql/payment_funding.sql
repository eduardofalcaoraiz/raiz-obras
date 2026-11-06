ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS funding_json jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.pagamentos.funding_json IS 'Investidores que financiam o pagamento: [{name, percent}]. pagn identifica quem executa/administra o pagamento. Nao cria despesas adicionais.';
NOTIFY pgrst, 'reload schema';

-- Permanent rule approved for Sa Pereira Recreio; no payment status/date is inferred.
CREATE OR REPLACE FUNCTION public.payment_sa_funding_default() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' AND coalesce(trim(NEW.pagn),'')='' AND NEW.obra_id=7 AND coalesce(NEW.escopo_fin,'obra')='obra' AND NEW.nf_tipo='Sem nota' THEN
  NEW.pagn:='DAVELINO IMOVEIS LTDA';
  NEW.funding_json:='[{"name":"R. E. PARTICIPACOES E EMPREENDIMENTOS LTDA","percent":50},{"name":"JP TERRAZI EMPREENDIMENTOS PARTICIPACOES E LOCACOES LTDA","percent":50}]'::jsonb;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER payment_sa_funding_default
BEFORE INSERT OR UPDATE ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.payment_sa_funding_default();
