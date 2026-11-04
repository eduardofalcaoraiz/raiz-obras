ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS funding_json jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.pagamentos.funding_json IS 'Investidores que financiam o pagamento: [{name, percent}]. pagn identifica quem executa/administra o pagamento. Nao cria despesas adicionais.';
NOTIFY pgrst, 'reload schema';
