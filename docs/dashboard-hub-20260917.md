# Central de dashboards

## Escopo

- Aba Dashboards como entrada de gestao, com dez paineis derivados das permissoes existentes.
- Filtros de marca, ciclo, unidade e obra; identidade usa logos e paleta ja cadastrados.
- Paineis de CAPEX, obras, imoveis, sublocacoes, contas a pagar, fornecedores, investidores, documentos e fila.
- Nenhum total geral mistura contrato, desembolso, verba CAPEX e aluguel de referencia.
- As telas operacionais preservam cadastros, aprovacoes, documentos e edicao. Os paineis agregados ficam na central.
- Obras abrem em Pagamentos; Cadastro e aportes preserva investimento, teto, aditivos e depositos.
- CAPEX abre diretamente a hierarquia de registros e lista os pedidos da unidade sem exigir uma etapa de dashboard.
- Real Estate preserva as secoes separadas de aluguel, IPTU, condominio e outros encargos.

## Navegacao e seguranca

- Links de dashboard sao enderecaveis por hash, com filtros na URL.
- Retorno aos dashboards conserva o recorte; navegacao entre modulos conserva busca e marca.
- Historico do navegador funciona entre paineis, registros e rotas existentes de Real Estate.
- A aba central nao cria uma nova permissao nem amplia acesso: cada painel exige o modulo original.
- Abrir ciclos antigos de CAPEX nao chama mais a gravacao automatica de finalizacao.
- Consultas nao enviam convites, nao executam sincronizacao Zeev e nao alteram dados financeiros.
- Falha de leitura mostra erro com nova tentativa, sem apresentar totais ficticios iguais a zero.

## Validacao

- 117 testes de modelo, permissoes, convites simulados, dossies e rotas.
- Playwright com dados sinteticos e todas as escritas externas bloqueadas.
- 33 capturas por execucao em 1440x1000 e 390x844.
- Conferidos filtros, recortes, navegacao voltar/avancar, acesso de leitura, abas de obra e estados vazios.
- Arquivos preexistentes copiados para backup antes da edicao.
- Publicacao por lista explicita de arquivos, verificando concorrencia com o estado remoto.

## Limites preservados

Esta alteracao reorganiza a apresentacao dos dados existentes. Nao revalida contratos, valores de TRs, comprovantes ou a completude das fontes. Referencias cadastrais nao comprovam pagamento.
