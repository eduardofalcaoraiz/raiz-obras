-- nossas_escolas_B.sql
-- Normaliza capex_itens: unidade → nome completo do cadastro, marca → nome oficial da marca
-- Rodar DEPOIS de nossas_escolas_A.sql

UPDATE capex_itens SET
  marca = CASE
    WHEN unidade IN ('LEO ALFA','LEO BETA','LEO GAMA') THEN 'LEONARDO DA VINCI'
    WHEN unidade ILIKE 'SARAH DAWSEY%'                  THEN 'SARAH DAWSEY'
    WHEN unidade ILIKE 'SÁ PEREIRA%' OR unidade ILIKE 'SA PEREIRA%' THEN 'SÁ PEREIRA'
    WHEN unidade ILIKE 'GLOBAL TREE%'                   THEN 'GLOBAL TREE'
    WHEN unidade ILIKE 'CUBO%'                          THEN 'CUBO'
    WHEN unidade ILIKE 'MATRIZ%'                        THEN 'MATRIZ'
    WHEN unidade ILIKE 'APOGEU%'                        THEN 'APOGEU'
    WHEN unidade ILIKE 'QI%'                            THEN 'QI'
    WHEN unidade ILIKE 'RAIZ%'                          THEN 'RAIZ'
    WHEN unidade ILIKE 'AMERICANO%'                     THEN 'AMERICANO'
    WHEN unidade ILIKE 'UNIFICADO%'                     THEN 'UNIFICADO'
    WHEN unidade ILIKE 'SAP%'                           THEN 'SAP'
    ELSE marca
  END,
  unidade = CASE unidade
    -- LEONARDO DA VINCI
    WHEN 'LEO ALFA'  THEN 'Colégio Leonardo da Vinci Alfa'
    WHEN 'LEO BETA'  THEN 'Colégio Leonardo da Vinci Beta'
    WHEN 'LEO GAMA'  THEN 'Colégio Leonardo da Vinci Gama'
    -- CUBO
    WHEN 'CUBO BOTAFOGO'   THEN 'Cubo Global School Botafogo'
    WHEN 'CUBO BARRA GOLF' THEN 'Cubo Global School Barra Golf'
    WHEN 'CUBO MARAPENDI'  THEN 'Cubo Global School Marapendi'
    -- QI
    WHEN 'QI FREGUESIA'     THEN 'Colégio QI Freguesia'
    WHEN 'QI METROPOLITANO' THEN 'Colégio QI Metropolitano'
    WHEN 'QI RIO 2'         THEN 'Colégio QI Rio 2'
    WHEN 'QI RECREIO'       THEN 'Colégio QI Recreio'
    WHEN 'QI TIJUCA'        THEN 'Colégio QI Tijuca'
    WHEN 'QI VALQUEIRE'     THEN 'Colégio QI Valqueire'
    WHEN 'QI BOTAFOGO'      THEN 'Colégio QI Botafogo'
    -- MATRIZ
    WHEN 'MATRIZ BANGU'         THEN 'Matriz Educação Bangu'
    WHEN 'MATRIZ CAMPO GRANDE'  THEN 'Matriz Educação Campo Grande'
    WHEN 'MATRIZ CAXIAS'        THEN 'Matriz Educação Caxias'
    WHEN 'MATRIZ MADUREIRA'     THEN 'Matriz Educação Madureira'
    WHEN 'MATRIZ NOVA IGUAÇU'   THEN 'Matriz Educação Nova Iguaçu'
    WHEN 'MATRIZ RETIRO'        THEN 'Matriz Educação Retiro'
    WHEN 'MATRIZ  RETIRO'       THEN 'Matriz Educação Retiro'
    WHEN 'MATRIZ ROCHA MIRANDA' THEN 'Matriz Educação Rocha Miranda'
    WHEN 'MATRIZ SAO JOAO'      THEN 'Matriz Educação São João de Meriti'
    WHEN 'MATRIZ TIJUCA'        THEN 'Matriz Educação Tijuca'
    WHEN 'MATRIZ TAQUARA'       THEN 'Matriz Educação Taquara'
    -- APOGEU
    WHEN 'APOGEU ZONA NORTE'         THEN 'Apogeu Global School Zona Norte'
    WHEN 'APOGEU CIDADE ALTA'        THEN 'Apogeu Global School Cidade Alta'
    WHEN 'APOGEU FERREIRA GUIMARÃES' THEN 'Apogeu Global School Ferreira Guimarães'
    WHEN 'APOGEU SANTO ANTONIO 1'    THEN 'Apogeu Global School Santo Antônio 1'
    WHEN 'APOGEU SANTO ANTONIO 2'    THEN 'Apogeu Global School Santo Antônio 2'
    -- AMERICANO
    WHEN 'AMERICANO CABRAL' THEN 'Colégio Americano Cabral'
    WHEN 'AMERICANO RAMIRO' THEN 'Colégio Americano Ramiro'
    -- UNIFICADO
    WHEN 'UNIFICADO ZONA SUL' THEN 'Colégio Unificado Zona Sul'
    -- SÁ PEREIRA
    WHEN 'SÁ PEREIRA CAPISTRANO' THEN 'Escola Sá Pereira Capistrano'
    WHEN 'SA PEREIRA CAPISTRANO' THEN 'Escola Sá Pereira Capistrano'
    WHEN 'SÁ PEREIRA MATRIZ'     THEN 'Escola Sá Pereira Matriz'
    WHEN 'SA PEREIRA MATRIZ'     THEN 'Escola Sá Pereira Matriz'
    -- SARAH DAWSEY
    WHEN 'SARAH DAWSEY TIJUCA' THEN 'Sarah Dawsey Tijuca'
    WHEN 'SARAH DAWSEY JF'     THEN 'Sarah Dawsey Juiz de Fora'
    -- GLOBAL TREE
    WHEN 'GLOBAL TREE BOTAFOGO'    THEN 'Global Tree Botafogo'
    WHEN 'GLOBAL TREE BARRA GOLF'  THEN 'Global Tree Barra Golf'
    WHEN 'GLOBAL TREE MARAPENDI'   THEN 'Global Tree Marapendi'
    WHEN 'GLOBAL TREE PENINSULA'   THEN 'Global Tree Península'
    WHEN 'GLOBAL TREE  PENINSULA'  THEN 'Global Tree Península'
    WHEN 'GLOBAL TREE PENÍNSULA'   THEN 'Global Tree Península'
    WHEN 'GLOBAL TREE  PENÍNSULA'  THEN 'Global Tree Península'
    WHEN 'GLOBAL TREE RIO 2'       THEN 'Global Tree Rio 2'
    -- RAIZ
    WHEN 'RAIZ SEDE' THEN 'Raiz Sede'
    WHEN 'RAIZ SUL'  THEN 'Raiz Sul'
    -- SAP
    WHEN 'SAP BARRINHA' THEN 'SAP Barrinha'
    ELSE unidade
  END;
