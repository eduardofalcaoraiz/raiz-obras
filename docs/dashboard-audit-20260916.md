# Auditoria e reconstrucao dos dashboards

Data: 16/09/2026. Escopo: apresentacao e calculos locais, sem alteracao dos registros financeiros, aprovacoes ou permissoes.

## Inventario

| Area | Correcao principal |
| --- | --- |
| CAPEX geral, ciclo, marca e unidade | Mesmos calculos em todos os niveis; filtros explicitos; composicao por unidade; pedidos e financeiros vinculados sem dupla contagem |
| Expansoes e novas unidades | Indicadores passam a acompanhar busca e marca; pagamentos dentro e fora do contrato separados |
| Obra individual | Contrato, aditivos, pendentes, limites previstos, aportes reais e etapas fisicas em blocos distintos |
| Cobranca | Vencidos, vencimento hoje, futuros e sem vencimento; inclui status ATRASADO; cancelamentos excluidos |
| Fornecedores | Totais acompanham a busca; quantidade de lancamentos nao e tratada como quantidade de NFs |
| Investidores | Depositos cadastrados nao sao inventados a partir de pagamentos; diferenca de conciliacao explicita |
| Real Estate | Resumos acompanham filtros e marca; aluguel de referencia separado de encargos; encerrados fora da referencia vigente |
| Dossie de cada imovel | Total nominal, conciliacao, previsoes e quantidade separados; preservada a divisao aluguel/IPTU/condominio/outros |
| Documentos | Cobertura documental por unidade filtrada, sem inferir regularidade juridica |
| Fila de registros | Valores finais, indefinidos e nao finais separados; status final nao significa automaticamente pronto para registrar |

## Definicoes financeiras

- CAPEX comprometido: soma dos registros nao cancelados apos a consolidacao dos vinculos financeiros existente na plataforma. Resolvido e situacao operacional, nao prova de pagamento.
- Saldo CAPEX calculavel: verba menos compromissos somente nas unidades/ciclos com verba cadastrada valida. Unidades sem verba ou com verbas conflitantes ficam identificadas separadamente, sem assumir verba zero.
- Saldo contratual: contrato base + aditivos - pagamentos dentro da obra. Saldo apos pendencias subtrai tambem os lancamentos em aberto dentro da obra. Gastos extras nao reduzem o contrato.
- Investimento previsto e teto do caixa: limites cadastrados, nao depositos recebidos. Diferenca pode ser negativa; nao ha truncamento artificial para zero.
- Aportes: apenas registros de depositos. Pagamento direto de investidor sem deposito pode gerar diferenca negativa de conciliacao, sem inferir divida.
- Evolucao mensal de pagamentos: somente data de pagamento. Vencimento e emissao nao substituem data ausente. Valores historicos sem lancamentos nao sao distribuidos por mes ou fornecedor.
- Vencidos: lancamentos em aberto com vencimento anterior a data atual em America/Sao_Paulo. Hoje nao e atraso. Data ausente fica em grupo proprio.
- Etapas: somente concluido conta como conclusao. Nao realizado permanece distinto. Percentual financeiro nao e avanco fisico.
- Real Estate: referencia cadastral de aluguel/cobranca nao comprova pagamento, nem constitui fluxo de caixa. Historico nominal preserva as regras de conciliacao, rateios, cancelamentos e previsoes existentes.
- Exportacoes CSV de composicao refletem o recorte completo, mesmo quando a tabela de prioridades mostra um subconjunto. Campos textuais neutralizam formulas de planilha.

## Conferencia da base

Consulta SQL somente de leitura, agrupada e sem anexos/raw payloads:

- 1.704 lancamentos com status PAGO; 32 PENDENTE; 36 cancelados.
- CAPEX 2026: 310 resolvidos, 42 em andamento, 93 cancelados. Dos em andamento, 30 possuem valor vazio ou zero na fonte. Contagens brutas, anteriores a consolidacao compra/financeiro.
- Nenhuma duplicidade exata de ano/unidade encontrada em capex_saldos. A interface tambem detecta conflito apos normalizacao do nome.
- Imoveis: 63 ativos, 13 em atencao, 1 em renovacao, 3 encerrados. Sublocacoes: 25 ativas e 28 em atencao.
- Estes numeros sao um retrato da consulta, nao uma alteracao ou validacao individual dos contratos e tickets. Nao houve sincronizacao Zeev nem limpeza de dados.

## Verificacao

- Testes puros em scripts/test_dashboard_data.cjs: valores ausentes, centavos, datas, cancelados, vencimento hoje, escopos, verbas conflitantes, aportes, etapas e documentos.
- Regressao das permissoes, convites e conciliacao Real Estate: 111 testes aprovados na bateria de 10 arquivos.
- scripts/test_dashboard_ui.cjs: navegacao real em Chromium, 1440x1000 e 390x844, filtros, resumos, leitura, estado vazio, capturas e ausencia de escritas. Dados sinteticos; nao envia emails, nao aprova registros e nao acessa o navegador de trabalho do usuario.
- Execucao UI: node scripts/test_dashboard_ui.cjs (Playwright no NODE_PATH). --production valida os arquivos publicados, mantendo dados e rede financeira simulados. DASHBOARD_TEST_OUTPUT define a pasta das capturas.
- Arquivos de evidencia locais ficam fora do repositorio. Publicacao limitada a uma lista explicita de arquivos, com comparacao do estado remoto antes do commit.

## Limites conhecidos

- Valores antigos ausentes, valores finais de tickets e pagamentos ainda nao confirmados nao sao corrigidos por suposicao. O painel sinaliza as lacunas; a origem precisa de revisao documental.
- As regras de rateio existentes foram preservadas; nao foi criado rateio igualitario entre marcas ou imoveis.
- A conciliacao de Real Estate permanece nominal. Nomes de comprovantes e status de workflow nao foram convertidos automaticamente em quitacao.
