-- Passo 1: adiciona coluna marca na tabela capex_itens
ALTER TABLE capex_itens ADD COLUMN IF NOT EXISTS marca text DEFAULT '';

-- Passo 2: popula marca com base no nome da unidade
UPDATE capex_itens SET marca = CASE
  WHEN unidade ILIKE 'SARAH DAWSEY%'                        THEN 'SARAH DAWSEY'
  WHEN unidade ILIKE 'SÁ PEREIRA%' OR unidade ILIKE 'SA PEREIRA%' THEN 'SÁ PEREIRA'
  WHEN unidade ILIKE 'GLOBAL TREE%'                         THEN 'GLOBAL TREE'
  WHEN unidade ILIKE 'CUBO%'                                THEN 'CUBO'
  WHEN unidade ILIKE 'LEO%'                                 THEN 'LEO'
  WHEN unidade ILIKE 'MATRIZ%'                              THEN 'MATRIZ'
  WHEN unidade ILIKE 'APOGEU%'                              THEN 'APOGEU'
  WHEN unidade ILIKE 'QI%'                                  THEN 'QI'
  WHEN unidade ILIKE 'RAIZ%'                                THEN 'RAIZ'
  WHEN unidade ILIKE 'AMERICANO%'                           THEN 'AMERICANO'
  WHEN unidade ILIKE 'UNIFICADO%'                           THEN 'UNIFICADO'
  ELSE upper(split_part(trim(unidade), ' ', 1))
END
WHERE marca = '' OR marca IS NULL;
