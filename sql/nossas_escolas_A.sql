-- Passo 1: adiciona campos CNPJ e endereço às unidades
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS cnpj text DEFAULT '';
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS endereco text DEFAULT '';

-- Passo 2: insere as 48 escolas do grupo Raiz
INSERT INTO unidades (id, nome, marca, tipo, cnpj, endereco) VALUES
  -- RAIZ
  ('u50', 'Raiz Sede',   'RAIZ', 'Em operação', '', ''),
  ('u51', 'Raiz Sul',    'RAIZ', 'Em operação', '', ''),
  -- LEONARDO DA VINCI
  ('u52', 'Colégio Leonardo da Vinci Alfa',  'LEONARDO DA VINCI', 'Em operação', '', ''),
  ('u53', 'Colégio Leonardo da Vinci Beta',  'LEONARDO DA VINCI', 'Em operação', '', ''),
  ('u54', 'Colégio Leonardo da Vinci Gama',  'LEONARDO DA VINCI', 'Em operação', '', ''),
  -- CUBO
  ('u55', 'Cubo Global School Botafogo',           'CUBO', 'Em operação', '', ''),
  ('u56', 'Cubo Global School Barra Golf',          'CUBO', 'Em operação', '', ''),
  ('u57', 'Cubo Global School Marapendi',           'CUBO', 'Em operação', '', ''),
  ('u58', 'Cubo Global School Botafogo Lucena',     'CUBO', 'Em operação', '', ''),
  ('u59', 'Cubo Global School Botafogo Assunção',   'CUBO', 'Em operação', '', ''),
  -- QI
  ('u60', 'Colégio QI Freguesia',    'QI', 'Em operação', '', ''),
  ('u61', 'Colégio QI Metropolitano','QI', 'Em operação', '', ''),
  ('u62', 'Colégio QI Rio 2',        'QI', 'Em operação', '', ''),
  ('u63', 'Colégio QI Recreio',      'QI', 'Em operação', '', ''),
  ('u64', 'Colégio QI Tijuca',       'QI', 'Em operação', '', ''),
  ('u65', 'Colégio QI Valqueire',    'QI', 'Em operação', '', ''),
  ('u66', 'Colégio QI Botafogo',     'QI', 'Em operação', '', ''),
  -- MATRIZ
  ('u67', 'Matriz Educação Bangu',             'MATRIZ', 'Em operação', '', ''),
  ('u68', 'Matriz Educação Campo Grande',      'MATRIZ', 'Em operação', '', ''),
  ('u69', 'Matriz Educação Caxias',            'MATRIZ', 'Em operação', '', ''),
  ('u70', 'Matriz Educação Madureira',         'MATRIZ', 'Em operação', '', ''),
  ('u71', 'Matriz Educação Nova Iguaçu',       'MATRIZ', 'Em operação', '', ''),
  ('u72', 'Matriz Educação Retiro',            'MATRIZ', 'Em operação', '', ''),
  ('u73', 'Matriz Educação Rocha Miranda',     'MATRIZ', 'Em operação', '', ''),
  ('u74', 'Matriz Educação São João de Meriti','MATRIZ', 'Em operação', '', ''),
  ('u75', 'Matriz Educação Tijuca',            'MATRIZ', 'Em operação', '', ''),
  ('u76', 'Matriz Educação Taquara',           'MATRIZ', 'Em operação', '', ''),
  ('u77', 'Expansão Matriz Bangu',             'MATRIZ', 'Em operação', '', ''),
  -- APOGEU
  ('u78', 'Apogeu Global School Zona Norte',            'APOGEU', 'Em operação', '', ''),
  ('u79', 'Apogeu Global School Cidade Alta',           'APOGEU', 'Em operação', '', ''),
  ('u80', 'Apogeu Global School Ferreira Guimarães',    'APOGEU', 'Em operação', '', ''),
  ('u81', 'Apogeu Global School Santo Antônio 1',       'APOGEU', 'Em operação', '', ''),
  ('u82', 'Apogeu Global School Santo Antônio 2',       'APOGEU', 'Em operação', '', ''),
  -- AMERICANO
  ('u83', 'Colégio Americano Cabral', 'AMERICANO', 'Em operação', '', ''),
  ('u84', 'Colégio Americano Ramiro', 'AMERICANO', 'Em operação', '', ''),
  -- UNIFICADO
  ('u85', 'Colégio Unificado Zona Sul', 'UNIFICADO', 'Em operação', '', ''),
  -- SÁ PEREIRA
  ('u86', 'Escola Sá Pereira Capistrano', 'SÁ PEREIRA', 'Em operação', '', ''),
  ('u87', 'Escola Sá Pereira Matriz',     'SÁ PEREIRA', 'Em operação', '', ''),
  -- SAP
  ('u88', 'SAP Barrinha', 'SAP', 'Em operação', '', ''),
  -- SARAH DAWSEY
  ('u89', 'Sarah Dawsey Tijuca',       'SARAH DAWSEY', 'Em operação', '', ''),
  ('u90', 'Sarah Dawsey Juiz de Fora', 'SARAH DAWSEY', 'Em operação', '', ''),
  -- GLOBAL TREE
  ('u91', 'Global Tree Botafogo',   'GLOBAL TREE', 'Em operação', '', ''),
  ('u92', 'Global Tree Barra Golf', 'GLOBAL TREE', 'Em operação', '', ''),
  ('u93', 'Global Tree Marapendi',  'GLOBAL TREE', 'Em operação', '', ''),
  ('u94', 'Global Tree Península',  'GLOBAL TREE', 'Em operação', '', ''),
  ('u95', 'Global Tree Rio 2',      'GLOBAL TREE', 'Em operação', '', ''),
  -- INTEGRA
  ('u96', 'Escola Integra', 'INTEGRA', 'Em operação', '', ''),
  -- UNIÃO
  ('u97', 'Colégio União', 'UNIÃO', 'Em operação', '', '')
ON CONFLICT (id) DO NOTHING;
