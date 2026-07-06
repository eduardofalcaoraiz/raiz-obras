const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type AnyRecord = Record<string, any>

const DEFAULT_FLOW_IDS = [299, 275, 102, 300]
const FINANCE_FLOW_IDS = new Set([299, 275])
const CAPEX_FIELDS = ['investimentoCAPEX', 'cAPEX', 'CAPEX', 'capex']
const FINANCE_DESCRIPTION_FIELDS = [
  'informacoesReferentesASolicitacao',
  'informacoesReferentesSolicitacao',
  'informacoesReferenteASolicitacao',
  'informacaoReferenteASolicitacao',
  'informacaoReferenteSolicitacao',
  'informacoesDaSolicitacao',
  'informacoesSolicitacao',
  'informacaoSolicitacao',
  'informacoes',
  'informacao',
  'Informacoes referentes a solicitacao',
  'Informacao referente a solicitacao',
]
const PURCHASE_SERVICE_DESCRIPTION_FIELDS = [
  'descricaoMensagemZeev',
  'descricaoDoServico',
  'descricaoServico',
  'descricaoServicoSolicitado',
  'descricaoServicoCompra',
  'descricao do servico',
]
const PURCHASE_JUSTIFICATION_FIELDS = [
  'JUSTIFICATIVA DO PEDIDO',
  'Justificativa do Pedido',
  'justificativaDoPedido',
  'justificativa do pedido',
  'justificativaPedido',
  'justificativa pedido',
  'justificativaPedidoCompra',
  'justificativaPedidoCompras',
  'justificativaDoPedidoCompra',
  'justificativa do pedido de compra',
  'justificativaDaCompra',
  'justificativa da compra',
  'justificativaDaSolicitacao',
  'justificativa da solicitacao',
  'justificativaSolicitacao',
  'motivoDoPedido',
  'motivo do pedido',
]
const PURCHASE_ITEM_DESCRIPTION_FIELDS = [
  'item',
  'itens',
  'produto',
  'produtos',
  'material',
  'materiais',
  'nomeItem',
  'nomeDoItem',
  'nome do item',
  'descricaoItem',
  'descricao do item',
  'itemCotacao',
  'item para cotacao',
  'listaParaCotacao',
  'lista de itens para cotacao',
  'lista para cotacao',
]
const EXTRA_FIELDS = [
  'valorTotalDoPagamento',
  'valorTotalPagamento',
  'valor',
  'valorTotal',
  'valorFinal',
  'valorCompra',
  'valorDaCompra',
  'valorSolicitado',
  'valorPedido',
  'valorAprovado',
  'precoUnitario',
  'valorOrcado',
  'valorEstimado',
  'orcamento',
  'preco',
  'precoFinal',
  'precoTotal',
  'total',
  'unidade',
  'unidadeEscolar',
  'escola',
  'filial',
  'marca',
  'centroCusto',
  'centroDeCusto',
  'localEntrega',
  'descricao',
  'descricaoSolicitacao',
  'pedido',
  'solicitacao',
  'objeto',
  'resumo',
  'justificativa',
  ...PURCHASE_JUSTIFICATION_FIELDS,
  'fornecedor',
  'nomeFornecedor',
  'razaoSocial',
  'categoria',
  'categoriaCompra',
  'tipoCompra',
  'setor',
  'departamento',
  'numeroTR',
  'ticket',
  'tr',
]

const VALUE_TOTAL_FIELDS = [
  'valorTotalDoPagamento',
  'Valor total do pagamento',
  'valorTotalPagamento',
  'valor total pagamento',
  'valorFinal',
  'valor final',
  'valorFinalDaCompra',
  'valor final da compra',
  'valorTotal',
  'valor total',
  'valorTotalDaCompra',
  'valor total da compra',
  'valorDaCompra',
  'valor da compra',
  'valorCompra',
  'valorPedido',
  'valor do pedido',
  'valorAprovado',
  'valor aprovado',
  'valorSolicitado',
  'valor solicitado',
  'valorOrcado',
  'valor orcado',
  'valorEstimado',
  'valor estimado',
  'orcamento',
  'orçamento',
  'precoFinal',
  'preço final',
  'precoTotal',
  'preço total',
  'total',
  'valor',
  'valorPagamento',
  'valor do pagamento',
  'valorAPagar',
  'valor a pagar',
  'valorNotaFiscal',
  'valor da nota fiscal',
  'valor da nota',
  'valorOC',
  'valor da OC',
  'valorDaProposta',
  'valor da proposta',
  'valorNegociado',
  'valor negociado',
  'valorTitulo',
  'valor do titulo',
  'valor do título',
  'valorDocumento',
  'valor do documento',
  'valorLancamento',
  'valor lancamento',
  'valor do lançamento',
  'valorBruto',
  'valor bruto',
  'valorLiquido',
  'valor liquido',
  'totalPagamento',
  'total do pagamento',
  'totalAPagar',
  'total a pagar',
  'valorParcela',
  'valor da parcela',
]

const ITEM_DESC_FIELDS = [
  'item',
  'itens',
  'produto',
  'produtos',
  'material',
  'materiais',
  'servico',
  'servicos',
  'serviços',
  'descricaoProduto',
  'descrição do produto',
  'descricaoServico',
  'descrição do serviço',
  'descricaoItem',
  'descricao',
  'descrição',
  'detalhamento',
  ...PURCHASE_ITEM_DESCRIPTION_FIELDS,
]
const ITEM_QTY_FIELDS = ['quantidade', 'quantidadeSolicitada', 'quantidade solicitada', 'qtd', 'qtde']
const ITEM_UNIT_MEASURE_FIELDS = ['unidadeMedida', 'unidade medida', 'unidade', 'un']
const ITEM_UNIT_FIELDS = ['precoUnitario', 'preço unitário', 'preco unitario', 'valorUnitario', 'valor unitario', 'valor un']
const ITEM_TOTAL_FIELDS = ['valorTotalItem', 'valor total item', 'valor total do item', 'precoTotal', 'preço total', 'valorProduto', 'valor do produto', 'valorServico', 'valor do serviço']

const DOCUMENT_FIELDS = [
  'anexo',
  'anexos',
  'arquivo',
  'arquivos',
  'arquivoNF',
  'arquivo NF',
  'notaFiscal',
  'nota fiscal',
  'notaFiscalArquivo',
  'arquivoNotaFiscal',
  'documento',
  'documentoFiscal',
  'documento fiscal',
  'danfe',
  'xml',
  'pdf',
  'comprovante',
  'comprovantePagamento',
  'comprovante pagamento',
  'boleto',
  'pix',
  'recibo',
  'fatura',
]

const PURCHASE_ENRICH_FIELDS = [
  'cAPEX',
  'centroDeCusto',
  'centroCusto',
  'item',
  'itens',
  'produto',
  'produtos',
  'material',
  'materiais',
  'servico',
  'servicos',
  'descricao',
  'descricaoSolicitacao',
  'descricaoCompra',
  'descricaoProduto',
  'descricaoServico',
  'detalhamento',
  'justificativa',
  ...PURCHASE_JUSTIFICATION_FIELDS,
  'observacao',
  'observacoes',
  'quantidade',
  'quantidadeSolicitada',
  'qtd',
  'unidadeMedida',
  'valorTotalDoPagamento',
  'valorTotalPagamento',
  'valor',
  'valorTotal',
  'valorFinal',
  'valorCompra',
  'valorDaCompra',
  'valorSolicitado',
  'valorPedido',
  'valorAprovado',
  'valorOrcado',
  'valorEstimado',
  'orcamento',
  'preco',
  'precoUnitario',
  'precoTotal',
  'precoFinal',
  'valorUnitario',
  'valorTotalItem',
  'fornecedor',
  'nomeFornecedor',
  'razaoSocial',
  'cnpjFornecedor',
  'fornecedorEscolhido',
  'condicaoPagamento',
  'formaPagamento',
  'formaDePagamento',
  'dataPagamento',
  'previsaoPagamento',
  'dataEntrega',
  'prazoEntrega',
  'unidade',
  'unidadeEscolar',
  'escola',
  'filial',
  'marca',
  'localEntrega',
  'solicitante',
  'setor',
  'departamento',
  'categoria',
  'categoriaCompra',
  'tipoCompra',
  'numeroTR',
  'ticket',
  'tr',
  'notaFiscal',
  'numeroNF',
  'numeroNotaFiscal',
  'valorNotaFiscal',
  'chaveAcesso',
  ...DOCUMENT_FIELDS,
  ...PURCHASE_SERVICE_DESCRIPTION_FIELDS,
  ...PURCHASE_ITEM_DESCRIPTION_FIELDS,
]

const FINANCE_ENRICH_FIELDS = [
  'investimentoCAPEX',
  'valorTotalDoPagamento',
  'valorTotalPagamento',
  'valor',
  'valorTotal',
  'valorSolicitado',
  'valorPagamento',
  'valorAPagar',
  'valorAprovado',
  'precoUnitario',
  'dataPagamento',
  'previsaoPagamento',
  'dataVencimento',
  'dataDeVencimento',
  'formaPagamento',
  'formaDePagamento',
  'condicaoPagamento',
  'favorecido',
  'beneficiario',
  'fornecedor',
  'nomeFornecedor',
  'razaoSocial',
  'cnpj',
  'cnpjFornecedor',
  'centroDeCusto',
  'centroCusto',
  'unidade',
  'unidadeEscolar',
  'escola',
  'filial',
  'marca',
  'descricao',
  'descricaoSolicitacao',
  'solicitacao',
  'pedido',
  'objeto',
  'resumo',
  'justificativa',
  'observacao',
  'observacoes',
  'categoria',
  'categoriaFinanceira',
  'setor',
  'departamento',
  'numeroTR',
  'ticket',
  'tr',
  'notaFiscal',
  'numeroNF',
  'numeroNotaFiscal',
  'valorNotaFiscal',
  'chaveAcesso',
  ...DOCUMENT_FIELDS,
  ...FINANCE_DESCRIPTION_FIELDS,
]

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function env(name: string, fallback = '') {
  return Deno.env.get(name) || fallback
}

function secretAuthorized(req: Request) {
  const configuredSecrets = [env('ZEEV_SYNC_SECRET'), env('ZEEV_DB_CRON_SECRET')].filter(Boolean)
  if (!configuredSecrets.length) return false
  const got = req.headers.get('x-cron-secret') || ''
  const auth = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  return configuredSecrets.includes(got) || configuredSecrets.includes(auth)
}

function bearerToken(req: Request) {
  return (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
}

async function requireAppUser(req: Request) {
  const token = bearerToken(req)
  const anon = env('SUPABASE_ANON_KEY')
  if (!token || token === anon) throw new Error('Sessao de usuario ausente.')

  const authRes = await fetch(`${env('SUPABASE_URL').replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      apikey: anon || env('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${token}`,
    },
  })
  const authText = await authRes.text()
  if (!authRes.ok) throw new Error(`Sessao invalida: ${authText}`)
  const user = authText ? JSON.parse(authText) : null
  if (!user?.id) throw new Error('Usuario nao identificado.')

  const profileRows = await rest(`/user_profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,role,aprovado`)
  const profile = (profileRows || [])[0]
  if (!profile?.aprovado) throw new Error('Usuario ainda nao aprovado.')
  if (['leitor', 'doc'].includes(String(profile.role || '').toLowerCase())) {
    throw new Error('Perfil sem permissao para sincronizar o Zeev.')
  }
  return { user, profile }
}

function onlyDigits(value: unknown) {
  return String(value || '').replace(/\D/g, '')
}

function norm(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normKey(value: unknown) {
  return norm(value).replace(/[^a-z0-9]+/g, '')
}

function fieldNames(field: AnyRecord) {
  return [field?.name, field?.label, field?.title, field?.caption].filter((x) => String(x || '').trim()).map((x) => String(x))
}

function fieldMatches(field: AnyRecord, names: string[]) {
  const wanted = new Set(names.map((x) => norm(x)))
  const wantedKey = new Set(names.map((x) => normKey(x)))
  return fieldNames(field).some((name) => wanted.has(norm(name)) || wantedKey.has(normKey(name)))
}

function isYes(value: unknown) {
  const n = norm(value)
  return ['sim', 's', 'yes', 'true', '1'].includes(n)
}

function parseMoney(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  let s = String(value || '').trim()
  if (!s) return 0
  s = s.replace(/[^\d,.-]/g, '')
  if (!s) return 0
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.')
  else if (s.includes(',')) s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function fieldMap(fields: AnyRecord[]) {
  const map = new Map<string, AnyRecord[]>()
  for (const f of fields || []) {
    const keys = new Set<string>()
    for (const name of fieldNames(f)) {
      keys.add(norm(name))
      keys.add(normKey(name))
    }
    for (const key of keys) {
      if (!key) continue
      const arr = map.get(key) || []
      if (!arr.includes(f)) arr.push(f)
      map.set(key, arr)
    }
  }
  return map
}

function firstField(fields: Map<string, AnyRecord[]>, names: string[]) {
  for (const name of names) {
    const arr = fields.get(norm(name)) || fields.get(normKey(name))
    const found = arr?.find((f) => String(f?.value || '').trim())
    if (found) return String(found.value).trim()
  }
  return ''
}

function moneyByPriority(fields: Map<string, AnyRecord[]>, names: string[]) {
  for (const name of names) {
    const arr = fields.get(norm(name)) || fields.get(normKey(name))
    const values = (arr || []).map((f) => parseMoney(f?.value)).filter((v) => v > 0)
    if (values.length) return Math.max(...values)
  }
  return 0
}

function capexField(fields: AnyRecord[]) {
  for (const f of fields || []) {
    if ((CAPEX_FIELDS.some((name) => fieldMatches(f, [name])) || fieldNames(f).some((name) => normKey(name).includes('capex'))) && isYes(f?.value)) {
      return { name: f.name || '', value: f.value || '' }
    }
  }
  return null
}

function currentTask(tasks: AnyRecord[]) {
  return (tasks || []).find((t) => t?.active) || (tasks || [])[0] || null
}

function taskName(task: AnyRecord | null) {
  if (!task) return ''
  return String(task?.task?.name || task?.alias || task?.result || '').trim()
}

function ticketResultKind(row: AnyRecord) {
  const result = norm(row?.flowResult || '')
  if (result.includes('cancelado') || result.includes('cancelada')) return 'cancelado'
  if (result.includes('rejeitado') || result.includes('rejeitada') || result.includes('reprovado') || result.includes('reprovada')) return 'rejeitado'
  if (result.includes('concluido') || result.includes('concluida') || result.includes('aprovado') || result.includes('aprovada') || result.includes('finalizado') || result.includes('finalizada')) return 'concluido'
  return ''
}

function hasConferirEntrega(tasks: AnyRecord[]) {
  const t = currentTask(tasks)
  const hay = norm([t?.task?.name, t?.alias, t?.result].filter(Boolean).join(' '))
  return hay.includes('conferir entrega') || hay.includes('comunicar entrega') || hay.includes('receber entrega') || hay.includes('conferencia de entrega')
}

function valueIsFinalForPurchase(row: AnyRecord, tasks: AnyRecord[]) {
  const resultKind = ticketResultKind(row)
  if (resultKind === 'cancelado' || resultKind === 'rejeitado') return false
  if (row?.active === false || Boolean(row?.endDateTime)) {
    return true
  }
  return hasConferirEntrega(tasks)
}

function suggestedCapexStatus(row: AnyRecord, ready: boolean) {
  const resultKind = ticketResultKind(row)
  if (resultKind === 'cancelado' || resultKind === 'rejeitado') return { situacao: 'Cancelado', realizado: false }
  if (ready) return { situacao: 'Resolvido', realizado: true }
  return { situacao: 'Em Andamento', realizado: false }
}

function isCompra(row: AnyRecord) {
  const name = norm(row?.flow?.name || row?.flowName || row?.requestName || '')
  return name.includes('solicitacao de compras') || name.includes('solicitacoes de compras')
}

function isFinanceiro(row: AnyRecord) {
  const name = norm(row?.flow?.name || row?.flowName || row?.requestName || '')
  return name.includes('solicitacao financeira') || name.includes('solicitacoes financeiras') || name.includes('financeiro')
}

function flowId(row: AnyRecord) {
  return Number(row?.flow?.id || row?.flowId || 0) || null
}

function flowName(row: AnyRecord) {
  return String(row?.flow?.name || row?.flowName || row?.requestName || '').trim()
}

function flowVersion(row: AnyRecord) {
  return Number(row?.flow?.version || row?.flowVersion || 0) || null
}

function capexFieldsForFlow(flow: number) {
  if (FINANCE_FLOW_IDS.has(flow)) return ['investimentoCAPEX', 'É um investimento (CAPEX)?', 'E um investimento (CAPEX)?', 'CAPEX']
  if (flow === 102 || flow === 300) return ['cAPEX', 'CAPEX', 'Investimento CAPEX']
  return CAPEX_FIELDS
}

function enrichFieldsForFlow(flow: number) {
  const base = FINANCE_FLOW_IDS.has(flow) ? FINANCE_ENRICH_FIELDS : PURCHASE_ENRICH_FIELDS
  return [...new Set([...capexFieldsForFlow(flow), ...base])]
}

function iso(value: unknown) {
  const s = String(value || '').trim()
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function mergeFields(base: AnyRecord[], extra: AnyRecord[]) {
  const map = new Map<string, AnyRecord>()
  for (const f of [...(base || []), ...(extra || [])]) {
    const display = fieldNames(f)[0]
    if (!display) continue
    const key = `${normKey(display)}|${f.row || 1}`
    map.set(key, f)
  }
  return [...map.values()]
}

function fieldsObject(fields: AnyRecord[]) {
  const out: AnyRecord = {}
  for (const f of fields || []) {
    const display = fieldNames(f)[0]
    if (!display) continue
    const key = String(display)
    const val = f.value ?? ''
    if (!String(val).trim()) continue
    if (out[key] === undefined) out[key] = val
    else if (Array.isArray(out[key])) out[key].push(val)
    else out[key] = [out[key], val]
  }
  return out
}

function extractItems(fields: AnyRecord[]) {
  const rows = new Map<number, AnyRecord>()
  for (const f of fields || []) {
    const value = String(f?.value || '').trim()
    if (!value) continue
    const row = Number(f?.row || 1) || 1
    const bucket = rows.get(row) || { row }
    if (fieldMatches(f, ITEM_DESC_FIELDS)) bucket.descricao = value
    else if (fieldMatches(f, ITEM_QTY_FIELDS)) bucket.quantidade = parseMoney(value)
    else if (fieldMatches(f, ITEM_UNIT_MEASURE_FIELDS)) bucket.unidade = value
    else if (fieldMatches(f, ITEM_UNIT_FIELDS)) bucket.valor_unitario = parseMoney(value)
    else if (fieldMatches(f, ITEM_TOTAL_FIELDS)) bucket.valor_total = parseMoney(value)
    if (bucket.valor_unitario && bucket.quantidade && !bucket.valor_total) {
      bucket.valor_total = Number((Number(bucket.valor_unitario) * Number(bucket.quantidade)).toFixed(2))
    }
    rows.set(row, bucket)
  }
  return [...rows.values()].filter((r) => r.descricao || r.quantidade || r.valor_total || r.valor_unitario)
}

function itemsTotal(items: AnyRecord[]) {
  const total = (items || []).reduce((sum, item) => {
    if (Number(item?.valor_total)) return sum + Number(item.valor_total)
    if (Number(item?.valor_unitario) && Number(item?.quantidade)) return sum + Number(item.valor_unitario) * Number(item.quantidade)
    return sum
  }, 0)
  return total ? Number(total.toFixed(2)) : 0
}

function pickTicketValue(fmap: Map<string, AnyRecord[]>, items: AnyRecord[], financeiro: boolean) {
  const explicit = moneyByPriority(fmap, VALUE_TOTAL_FIELDS)
  if (explicit) return explicit
  if (financeiro) {
    const financeFallback = moneyByPriority(fmap, ['precoUnitario', 'preço unitário', 'preco unitario', 'valorUnitario', 'valor unitario'])
    if (financeFallback) return financeFallback
  }
  const totalItems = itemsTotal(items)
  if (totalItems) return totalItems
  return moneyByPriority(fmap, [...VALUE_TOTAL_FIELDS, ...ITEM_TOTAL_FIELDS])
}

function extractPagamento(fmap: Map<string, AnyRecord[]>) {
  return {
    forma: firstField(fmap, ['formaDePagamento', 'formaPagamento', 'condicaoPagamento']) || null,
    data_pagamento: firstField(fmap, ['dataPagamento']) || null,
    previsao_pagamento: firstField(fmap, ['previsaoPagamento', 'dataDeVencimento', 'dataVencimento']) || null,
    data_entrega: firstField(fmap, ['dataEntrega', 'prazoEntrega']) || null,
    nota_fiscal: firstField(fmap, ['notaFiscal', 'numeroNF', 'numeroNotaFiscal']) || null,
    chave_acesso: firstField(fmap, ['chaveAcesso']) || null,
  }
}

function cleanUnit(value: string) {
  return String(value || '').replace(/^\s*\d+(?:[.\-]\d+)*\s*-\s*/, '').trim()
}

function cleanItemDescription(value: unknown) {
  return String(value || '')
    .replace(/^\s*\d+(?:[.\-]\d+)*\s*-\s*/, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s;-]+|[\s;-]+$/g, '')
}

function decodeHtmlEntities(value: string) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n)
      return Number.isFinite(code) ? String.fromCodePoint(code) : _
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      const code = Number.parseInt(n, 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : _
    })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
}

function cleanZeevMessageBody(value: unknown) {
  let text = String(value || '')
  if (!text.trim()) return ''
  text = text
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  text = decodeHtmlEntities(text).replace(/\u00a0/g, ' ')
  return text
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim()
}

function genericPurchaseText(value: unknown) {
  const text = cleanItemDescription(value)
  const n = norm(text)
  if (!n) return false
  if (text.length <= 90 && /\bservico(s)?\b/.test(n)) return true
  return /^(servico|servicos|material|materiais|produto|produtos|item|itens)( de| para|$)/.test(n)
}

function formatQty(value: unknown) {
  const qty = Number(value || 0)
  if (!Number.isFinite(qty) || !qty) return ''
  return Number.isInteger(qty) ? String(qty) : String(qty).replace('.', ',')
}

function itemSummary(items: AnyRecord[]) {
  const parts: string[] = []
  for (const item of items || []) {
    const desc = cleanItemDescription(item?.descricao)
    if (!desc) continue
    const qty = formatQty(item?.quantidade)
    const unit = String(item?.unidade || '').trim()
    const prefix = [qty, unit].filter(Boolean).join(' ').trim()
    parts.push(prefix ? `${prefix} - ${desc}` : desc)
  }
  return parts.join('; ')
}

function cleanSummaryText(value: unknown) {
  return cleanZeevMessageBody(value)
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim()
}

function descriptionScore(value: unknown) {
  const text = cleanSummaryText(value)
  if (!text) return 0
  const words = text.split(/\s+/).filter(Boolean).length
  const punct = (text.match(/[.;:]/g) || []).length
  return text.length + words * 3 + punct * 12 - (genericPurchaseText(text) ? 90 : 0)
}

function bestDescription(values: unknown[]) {
  return (values || [])
    .map((v) => cleanSummaryText(v))
    .filter(Boolean)
    .sort((a, b) => descriptionScore(b) - descriptionScore(a))[0] || ''
}

function splitSummaryParts(text: string) {
  return cleanSummaryText(text)
    .split(/\n|[\u2022\u00b7]|(?:^|\s)\d+[.)]\s+|;\s+/g)
    .map((part) => part.replace(/^\s*[-\u2013\u2014]\s*/, '').replace(/\s+/g, ' ').trim())
    .filter((part) => part.length > 2)
}

function trimCardSummary(text: string, _limit?: number) {
  return cleanSummaryText(text)
}

function deterministicCardSummary(text: string, items: AnyRecord[], compra: boolean) {
  const clean = cleanSummaryText(text)
  if (!clean) return ''
  return clean
}

function allowCoreSummaryKeys() {
  return env('ZEEV_SUMMARY_ALLOW_GEMINI_GROQ', '0') === '1' || env('ZEEV_SUMMARY_USE_CORE_KEYS', '0') === '1'
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs = 35000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    const text = await res.text()
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
    return text ? JSON.parse(text) : {}
  } finally {
    clearTimeout(timer)
  }
}

async function summarizeWithGemini(text: string) {
  if (env('ZEEV_AI_SUMMARY_ENABLED', '1') === '0') return ''
  if (!allowCoreSummaryKeys()) return ''
  const key = env('GEMINI_API_KEY') || env('GOOGLE_API_KEY')
  if (!key) return ''
  const model = env('GEMINI_SUMMARY_MODEL') || 'gemini-2.5-flash-lite'
  const source = cleanSummaryText(text)
  const prompt = [
    'Resuma em portugues, em ate 2 frases curtas, apenas com dados existentes no texto.',
    'Nao invente fornecedor, valor, unidade, data ou item. Preserve nomes importantes.',
    '',
    `Texto do Ticket Raiz:\n${source}`,
  ].join('\n')
  const data = await fetchJsonWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 120 },
      }),
    },
  )
  const parts = data?.candidates?.[0]?.content?.parts || []
  const summary = cleanSummaryText(parts.map((part: AnyRecord) => part?.text || '').join(' '))
  return summary ? trimCardSummary(summary, 300) : ''
}

async function summarizeWithGroq(text: string) {
  if (env('ZEEV_AI_SUMMARY_ENABLED', '1') === '0') return ''
  if (!allowCoreSummaryKeys()) return ''
  const key = env('GROQ_API_KEY')
  if (!key) return ''
  const model = env('GROQ_SUMMARY_MODEL') || 'llama-3.1-8b-instant'
  const source = cleanSummaryText(text)
  const data = await fetchJsonWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 120,
      messages: [
        { role: 'system', content: 'Resuma tickets em portugues sem inventar nenhum dado.' },
        { role: 'user', content: `Resuma em ate 2 frases curtas, preservando nomes e itens importantes:\n\n${source}` },
      ],
    }),
  })
  const summary = cleanSummaryText(data?.choices?.[0]?.message?.content || '')
  return summary ? trimCardSummary(summary, 300) : ''
}

async function summarizeWithCloudflare(text: string) {
  if (env('ZEEV_AI_SUMMARY_ENABLED', '1') === '0') return ''
  const accountId = env('CLOUDFLARE_ACCOUNT_ID')
  const key = env('CLOUDFLARE_API_TOKEN') || env('CF_API_TOKEN')
  if (!accountId || !key) return ''
  const model = env('CLOUDFLARE_SUMMARY_MODEL') || '@cf/meta/llama-3.1-8b-instruct-fast'
  const source = cleanSummaryText(text)
  const data = await fetchJsonWithTimeout(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model.split('/').map((part) => encodeURIComponent(part)).join('/')}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'Resuma tickets em portugues sem inventar nenhum dado.' },
          { role: 'user', content: `Resuma em ate 2 frases curtas, preservando nomes e itens importantes:\n\n${source}` },
        ],
      }),
    },
  )
  const result = data?.result
  const summary = cleanSummaryText(typeof result === 'string' ? result : result?.response || result?.text || result?.generated_text || '')
  return summary ? trimCardSummary(summary, 300) : ''
}

async function summarizeWithMistral(text: string) {
  if (env('ZEEV_AI_SUMMARY_ENABLED', '1') === '0') return ''
  const key = env('MISTRAL_API_KEY')
  if (!key) return ''
  const model = env('MISTRAL_SUMMARY_MODEL') || 'mistral-small-latest'
  const source = cleanSummaryText(text)
  const data = await fetchJsonWithTimeout('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 120,
      messages: [
        { role: 'system', content: 'Resuma tickets em portugues sem inventar nenhum dado.' },
        { role: 'user', content: `Resuma em ate 2 frases curtas, preservando nomes e itens importantes:\n\n${source}` },
      ],
    }),
  })
  const summary = cleanSummaryText(data?.choices?.[0]?.message?.content || '')
  return summary ? trimCardSummary(summary, 300) : ''
}

async function summarizeWithHuggingFace(text: string) {
  if (env('ZEEV_AI_SUMMARY_ENABLED', '1') === '0') return ''
  const key = env('HF_TOKEN') || env('HUGGINGFACE_API_KEY')
  if (!key) return ''
  const model = env('HF_SUMMARY_MODEL') || 'meta-llama/Llama-3.1-8B-Instruct'
  const source = cleanSummaryText(text)
  const data = await fetchJsonWithTimeout('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 120,
      messages: [
        { role: 'system', content: 'Resuma tickets em portugues sem inventar nenhum dado.' },
        { role: 'user', content: `Resuma em ate 2 frases curtas, preservando nomes e itens importantes:\n\n${source}` },
      ],
    }),
  })
  const summary = cleanSummaryText(data?.choices?.[0]?.message?.content || '')
  return summary ? trimCardSummary(summary, 300) : ''
}

async function cardSummaryCascade(text: string, items: AnyRecord[], compra: boolean) {
  const clean = cleanSummaryText(text)
  if (!clean) return { text: '', source: '' }
  const deterministic = deterministicCardSummary(clean, items, compra)
  for (const [source, fn] of [
    ['cloudflare', summarizeWithCloudflare],
    ['mistral', summarizeWithMistral],
    ['huggingface', summarizeWithHuggingFace],
    ['groq-reserva', summarizeWithGroq],
    ['gemini-reserva', summarizeWithGemini],
  ] as const) {
    try {
      const summary = await fn(clean)
      if (summary && descriptionScore(summary) > 30 && summary.length <= Math.max(320, clean.length)) return { text: summary, source }
    } catch (error) {
      console.warn('Zeev summary provider failed', source, error instanceof Error ? error.message : String(error))
    }
  }
  return { text: deterministic, source: 'texto-completo' }
}

function ticketDescription(fmap: Map<string, AnyRecord[]>, items: AnyRecord[], financeiro: boolean, compra: boolean) {
  if (financeiro) return firstField(fmap, FINANCE_DESCRIPTION_FIELDS)
  if (compra) {
    const justification = firstField(fmap, PURCHASE_JUSTIFICATION_FIELDS)
    const serviceDesc = firstField(fmap, PURCHASE_SERVICE_DESCRIPTION_FIELDS)
    const itemsText = itemSummary(items)
    if (itemsText && (!serviceDesc || genericPurchaseText(serviceDesc) || descriptionScore(itemsText) > descriptionScore(serviceDesc) + 40)) return itemsText
    if (justification && (!itemsText || descriptionScore(justification) > descriptionScore(serviceDesc) + 35)) return justification
    if (serviceDesc) return serviceDesc
    return bestDescription([itemsText, justification, serviceDesc])
  }
  return ''
}

function looksTruncatedZeevText(value: unknown) {
  const s = String(value || '').trim()
  if (s.length !== 100) return false
  return !/[.!?:;)\]]$/.test(s)
}

function bestMessageDescription(messages: AnyRecord[], serviceDesc = '', itemText = '') {
  const bodies = (messages || [])
    .map((msg) => cleanZeevMessageBody(msg?.body))
    .filter((body) => {
      if (body.length < 80) return false
      const n = norm(body)
      return !['cancelado', 'ajustado', 'ok', 'aprovado', 'reprovado'].some((prefix) => n.startsWith(prefix))
    })
  if (!bodies.length) return ''

  const serviceNorm = norm(serviceDesc)
  if (serviceNorm) {
    const needle = serviceNorm.slice(0, Math.min(70, serviceNorm.length))
    const matched = bodies.find((body) => needle && norm(body).includes(needle))
    if (matched) return matched
  }

  const cues = ['solicita', 'necess', 'escopo', 'servico', 'servicos', 'instalacao', 'fornecimento', 'compra', 'adequacao']
  const cued = bodies.filter((body) => cues.some((cue) => norm(body).includes(cue)))
  if (cued.length) return cued.sort((a, b) => b.length - a.length)[0]
  if (genericPurchaseText(itemText)) return bodies.sort((a, b) => b.length - a.length)[0]
  return ''
}

async function buildTicket(row: AnyRecord) {
  const fields = Array.isArray(row?.formFields) ? row.formFields : []
  const tasks = Array.isArray(row?.instanceTasks) ? row.instanceTasks : []
  const capex = capexField(fields)
  if (!capex) return null

  const fmap = fieldMap(fields)
  const compra = isCompra(row)
  const financeiro = isFinanceiro(row)
  const atual = currentTask(tasks)
  const etapa = taskName(atual)
  const conferir = valueIsFinalForPurchase(row, tasks)
  const itens = extractItems(fields)
  const valor = pickTicketValue(fmap, itens, financeiro)
  const resultKind = ticketResultKind(row)
  const valorFinal = valor && resultKind !== 'cancelado' && resultKind !== 'rejeitado' && (!compra || conferir || financeiro) ? valor : null
  const valorStatus = valorFinal ? 'final' : compra && valor ? 'em_aprovacao' : valor ? 'estimado' : 'nao_encontrado'
  const desc = ticketDescription(fmap, itens, financeiro, compra)
  const serviceDesc = compra ? firstField(fmap, PURCHASE_SERVICE_DESCRIPTION_FIELDS) : ''
  const descTruncada = Boolean(compra && serviceDesc && serviceDesc === desc && looksTruncatedZeevText(desc))
  const unidade = firstField(fmap, ['unidadeEscolar', 'unidade', 'escola', 'filial', 'localEntrega']) || cleanUnit(firstField(fmap, ['centroDeCusto', 'centroCusto']))
  const marca = firstField(fmap, ['marca'])
  const categoria = firstField(fmap, ['categoriaCompra', 'categoria', 'tipoCompra'])
  const pagamento = extractPagamento(fmap)
  const campos = fieldsObject(fields)
  const resumo = await cardSummaryCascade(desc || '', itens, compra)
  if (resumo.text) {
    campos._resumo_card = resumo.text
    campos._resumo_card_source = resumo.source
    campos._pedido_completo_chars = cleanSummaryText(desc || '').length
  }
  if (descTruncada) {
    campos._descricao_status = 'parcial'
    campos._descricao_origem = 'descricaoDoServico'
    campos._descricao_alerta = 'O Zeev retornou a descricao do servico limitada a 100 caracteres. Abra o Ticket Raiz para conferir o texto integral.'
  }
  const setor = financeiro ? 'FINANCEIRO' : 'COMPRAS'
  const { situacao, realizado } = suggestedCapexStatus(row, conferir)
  const enrichmentErrors = Array.isArray(row.__enrichmentErrors) ? [...row.__enrichmentErrors] : []
  if (descTruncada) enrichmentErrors.push({ field: 'descricaoDoServico', warning: 'Descricao do servico retornada pelo Zeev com 100 caracteres; texto provavelmente parcial.' })

  return {
    zeev_instance_id: Number(row.id),
    zeev_uid: row.uid || null,
    flow_id: flowId(row),
    flow_name: flowName(row),
    flow_version: flowVersion(row),
    request_name: row.requestName || null,
    ticket_link: row.reportLink || null,
    confirmation_code: row.confirmationCode || null,
    start_date_time: iso(row.startDateTime),
    end_date_time: iso(row.endDateTime),
    last_finished_task_date_time: iso(row.lastFinishedTaskDateTime),
    active: row.active === undefined ? null : Boolean(row.active),
    flow_result: row.flowResult || '',
    capex_field_name: capex.name,
    capex_field_value: String(capex.value || ''),
    requester_name: row?.requester?.name || '',
    requester_email: row?.requester?.email || '',
    requester_username: row?.requester?.username || '',
    requester_team: row?.requester?.team?.name || '',
    etapa_atual: etapa,
    passou_conferir_entrega: conferir,
    pronto_valor_final: Boolean(compra && conferir),
    valor: valor || null,
    valor_final: valorFinal,
    valor_status: valorStatus,
    unidade: unidade || null,
    marca: marca || null,
    pedido: desc || null,
    categoria_capex: categoria || null,
    fonte: 'UNIDADE',
    setor,
    situacao_sugerida: situacao,
    realizado_sugerido: realizado,
    raw_fields: fields,
    raw_instance: row,
    raw_tasks: tasks,
    itens_json: itens,
    pagamento_json: { ...pagamento, valor_total: valor || null },
    campos_extraidos: campos,
    enrichment_errors: enrichmentErrors,
    last_seen_at: new Date().toISOString(),
  }
}

async function rest(path: string, init: RequestInit = {}) {
  const url = `${env('SUPABASE_URL').replace(/\/$/, '')}/rest/v1${path}`
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  const res = await fetch(url, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

async function getExisting(ids: number[]) {
  if (!ids.length) return new Map<number, AnyRecord>()
  const chunks: number[][] = []
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200))
  const map = new Map<number, AnyRecord>()
  for (const chunk of chunks) {
    const rows = await rest(`/capex_zeev_solicitacoes?zeev_instance_id=in.(${chunk.join(',')})&select=zeev_instance_id,status,email_notified_at,capex_item_id`)
    for (const row of rows || []) map.set(Number(row.zeev_instance_id), row)
  }
  return map
}

async function upsertTickets(tickets: AnyRecord[]) {
  if (!tickets.length) return []
  const saved: AnyRecord[] = []
  for (let i = 0; i < tickets.length; i += 100) {
    const chunk = tickets.slice(i, i + 100)
    const rows = await rest('/capex_zeev_solicitacoes?on_conflict=zeev_instance_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(chunk),
    })
    saved.push(...(rows || []))
  }
  return saved
}

function ticketDigits(value: unknown) {
  return String(value || '').replace(/\D/g, '')
}

function ticketDataPatch(ticket: AnyRecord, previous: AnyRecord = {}) {
  const oldDados = previous && typeof previous === 'object' ? previous : {}
  return {
    ...oldDados,
    campos: ticket.campos_extraidos || oldDados.campos || {},
    itens: ticket.itens_json || oldDados.itens || [],
    pagamento: ticket.pagamento_json || oldDados.pagamento || {},
    rawFields: ticket.raw_fields || oldDados.rawFields || [],
    atualizadoPeloZeevEm: new Date().toISOString(),
  }
}

async function reconcileRegisteredTickets(tickets: AnyRecord[]) {
  if (!tickets.length) return { capexLinked: 0, paymentMatched: 0 }
  const byTicket = new Map<string, AnyRecord>()
  for (const ticket of tickets || []) {
    const key = ticketDigits(ticket?.zeev_instance_id)
    if (key) byTicket.set(key, ticket)
  }
  if (!byTicket.size) return { capexLinked: 0, paymentMatched: 0 }

  const capexRows = await rest('/capex_itens?select=id,referencia,ticket_raiz_instance_id,ticket_raiz_dados')
  let capexLinked = 0
  for (const row of capexRows || []) {
    const key = ticketDigits(row.ticket_raiz_instance_id || row.referencia)
    const ticket = byTicket.get(key)
    if (!ticket) continue
    capexLinked++
    await rest(`/capex_itens?id=eq.${Number(row.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        ticket_raiz_url: ticket.ticket_link || null,
        ticket_raiz_instance_id: Number(ticket.zeev_instance_id),
        origem: 'ZEEV',
        ticket_raiz_dados: ticketDataPatch(ticket, row.ticket_raiz_dados || {}),
      }),
    })
    await rest(`/capex_zeev_solicitacoes?zeev_instance_id=eq.${Number(ticket.zeev_instance_id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'aprovado',
        capex_item_id: Number(row.id),
        aprovado_em: new Date().toISOString(),
      }),
    })
  }

  const paymentRows = await rest('/pagamentos?select=obra_id,ticket_raiz')
  let paymentMatched = 0
  for (const row of paymentRows || []) {
    const key = ticketDigits(row.ticket_raiz)
    if (key && byTicket.has(key)) paymentMatched++
  }
  return { capexLinked, paymentMatched }
}

async function getState(id: string) {
  const rows = await rest(`/zeev_sync_state?id=eq.${encodeURIComponent(id)}&select=*`)
  return (rows || [])[0] || null
}

async function saveState(id: string, patch: AnyRecord) {
  await rest('/zeev_sync_state?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ id, ...patch }]),
  })
}

function positiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function freshRunningLock(state: AnyRecord | null, ttlMinutes: number) {
  if (!state?.running) return null
  const updatedAt = Date.parse(String(state.updated_at || state.last_start_date || ''))
  if (!Number.isFinite(updatedAt)) return null
  const ageMs = Date.now() - updatedAt
  if (ageMs < 0) return state
  return ageMs <= ttlMinutes * 60 * 1000 ? state : null
}

async function claimSyncLock(ttlMinutes: number, start: string | null = null, end: string | null = null) {
  const rows = await rest('/rpc/claim_zeev_sync_lock', {
    method: 'POST',
    body: JSON.stringify({
      p_id: 'zeev-capex',
      p_ttl_minutes: Math.max(1, Math.round(ttlMinutes || 15)),
      p_start: start || null,
      p_end: end || null,
    }),
  })
  const row = Array.isArray(rows) ? rows[0] : rows
  return {
    claimed: row?.claimed === true,
    runningSince: row?.running_since || null,
    lockTtlMinutes: Number(row?.lock_ttl_minutes || ttlMinutes || 15),
  }
}

function parseFlowIds(value: unknown) {
  return String(value || '')
    .split(',')
    .map((v) => Number(String(v).trim()))
    .filter(Boolean)
}

function uniqueNumbers(values: unknown[]) {
  const out: number[] = []
  const seen = new Set<number>()
  for (const value of values || []) {
    const n = Number(value)
    if (!Number.isFinite(n) || !n || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

async function knownTicketRefreshIds(limit: number, flows: number[] = []) {
  const n = Math.max(0, Math.min(Number(limit) || 0, 25))
  if (!n) return []
  const flowFilter = flows.length ? `&flow_id=in.(${flows.join(',')})` : ''
  const recentApprovedLimit = Math.max(1, Math.ceil(n / 3))
  const staleLimit = Math.max(1, n - recentApprovedLimit)
  const recentApproved = await rest(`/capex_zeev_solicitacoes?status=eq.aprovado&capex_item_id=not.is.null${flowFilter}&select=zeev_instance_id,updated_at,last_seen_at,start_date_time&order=updated_at.desc&limit=${recentApprovedLimit}`)
  const staleKnown = await rest(`/capex_zeev_solicitacoes?status=in.(pendente,aprovado)${flowFilter}&select=zeev_instance_id,updated_at,last_seen_at,start_date_time&order=last_seen_at.asc.nullsfirst&limit=${staleLimit}`)
  return uniqueNumbers([...(recentApproved || []), ...(staleKnown || [])].map((row: AnyRecord) => row.zeev_instance_id)).slice(0, n)
}

async function zeevReport(flow: number, page: number, start: string, end: string) {
  const token = env('ZEEV_TOKEN')
  if (!token) throw new Error('ZEEV_TOKEN ausente nos secrets da Supabase.')
  const base = env('ZEEV_BASE_URL', 'https://raizeducacao.zeev.it').replace(/\/$/, '')
  const flowCapexFields = capexFieldsForFlow(flow)
  const cleanDate = (value: string) => String(value || '').replace(/\.\d{1,6}/, '').replace(/(?:Z|[+-]\d\d:\d\d)$/i, '')
  const offsetDate = (value: string) => {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return cleanDate(value)
    return d.toISOString().replace(/\.\d{3}Z$/, '+00:00')
  }
  const normalizedDate = (value: string) => {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return cleanDate(value)
    return d.toISOString().replace(/\.\d{3}Z$/, '')
  }
  const makeBody = (formFieldNames: string[], pageSize: number, begin: string, finish: string) => ({
    flowId: flow,
    startDateIntervalBegin: begin,
    startDateIntervalEnd: finish,
    recordsPerPage: pageSize,
    pageNumber: page,
    useCache: false,
    formFieldNames,
    showPendingInstanceTasks: true,
    showPendingAssignees: true,
  })
  const request = async (formFieldNames: string[], pageSize: number, begin: string, finish: string) => {
    const body = makeBody(formFieldNames, pageSize, begin, finish)
    return await fetch(`${base}/api/2/instances/report`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'User-Agent': 'RaizObraViva/1.0 (+https://raiz-obras.vercel.app)',
      },
      body: JSON.stringify(body),
    })
  }
  const attempts = [
    { begin: offsetDate(start), finish: offsetDate(end) },
    { begin: start, finish: end },
    { begin: normalizedDate(start), finish: normalizedDate(end) },
    { begin: cleanDate(start), finish: cleanDate(end) },
  ]
  const pageSizes = [Number(env('ZEEV_RECORDS_PER_PAGE', '30')) || 30, 10]
  const errors: string[] = []
  for (const dates of attempts) {
    for (const pageSize of pageSizes) {
      const res = await request(flowCapexFields, pageSize, dates.begin, dates.finish)
      const text = await res.text()
      if (res.ok) {
        const data = text ? JSON.parse(text) : []
        const rows = Array.isArray(data) ? data : [data]
        return { rows, pageSize }
      }
      errors.push(`${res.status} size=${pageSize} begin=${dates.begin}: ${text}`)
    }
  }
  throw new Error(`Zeev report flow ${flow} page ${page}: ${errors.join(' | ')}`)
}

async function zeevInstance(instanceId: number, flow: number, fields: string[]) {
  const token = env('ZEEV_TOKEN')
  if (!token) throw new Error('ZEEV_TOKEN ausente nos secrets da Supabase.')
  const base = env('ZEEV_BASE_URL', 'https://raizeducacao.zeev.it').replace(/\/$/, '')
  const url = new URL(`${base}/api/2/instances/${instanceId}`)
  for (const field of fields) url.searchParams.append('formFieldNames', field)
  url.searchParams.set('showPendingInstanceTasks', 'true')
  url.searchParams.set('showFinishedInstanceTasks', 'true')
  url.searchParams.set('showPendingAssignees', 'true')
  url.searchParams.set('useCache', 'false')
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'User-Agent': 'RaizObraViva/1.0 (+https://raiz-obras.vercel.app)',
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Zeev instance ${res.status} id ${instanceId} fields ${fields.join(',')}: ${text}`)
  return text ? JSON.parse(text) : {}
}

async function zeevMessages(instanceId: number) {
  const token = env('ZEEV_TOKEN')
  if (!token) throw new Error('ZEEV_TOKEN ausente nos secrets da Supabase.')
  const base = env('ZEEV_BASE_URL', 'https://raizeducacao.zeev.it').replace(/\/$/, '')
  const url = new URL(`${base}/api/2/messages/instance/${instanceId}`)
  url.searchParams.set('useCache', 'false')
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'User-Agent': 'RaizObraViva/1.0 (+https://raiz-obras.vercel.app)',
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Zeev messages ${res.status} id ${instanceId}: ${text}`)
  const data = text ? JSON.parse(text) : []
  return Array.isArray(data) ? data : []
}

async function collectInstanceFields(instanceId: number, flow: number, fields: string[], chunkSize = 8) {
  const found: AnyRecord[] = []
  const errors: AnyRecord[] = []
  let last: AnyRecord | null = null

  try {
    const data = await zeevInstance(instanceId, flow, [])
    if (Array.isArray(data.formFields)) found.push(...data.formFields)
    last = data
  } catch (error) {
    errors.push({ field: '__all__', error: error instanceof Error ? error.message : String(error) })
  }

  const queryChunk = async (chunk: string[]) => {
    if (!chunk.length) return
    try {
      const data = await zeevInstance(instanceId, flow, chunk)
      found.push(...(Array.isArray(data.formFields) ? data.formFields : []))
      return data
    } catch (error) {
      if (chunk.length === 1) {
        errors.push({ field: chunk[0], error: error instanceof Error ? error.message : String(error) })
        return null
      }
      const mid = Math.ceil(chunk.length / 2)
      await queryChunk(chunk.slice(0, mid))
      await queryChunk(chunk.slice(mid))
      return null
    }
  }

  for (let i = 0; i < fields.length; i += chunkSize) {
    const data = await queryChunk(fields.slice(i, i + chunkSize))
    if (data) last = data
  }
  return { fields: found, last, errors }
}

async function enrichRow(row: AnyRecord) {
  const flow = flowId(row) || 0
  const id = Number(row.id)
  if (!id || !flow) return row
  const fields = enrichFieldsForFlow(flow)
  const enriched = await collectInstanceFields(id, flow, fields)
  const detail = enriched.last || row
  let mergedFields = mergeFields(Array.isArray(row.formFields) ? row.formFields : [], enriched.fields)
  const errors = [...enriched.errors]
  if (!FINANCE_FLOW_IDS.has(flow)) {
    const fmap = fieldMap(mergedFields)
    const serviceDesc = firstField(fmap, PURCHASE_SERVICE_DESCRIPTION_FIELDS.filter((name) => name !== 'descricaoMensagemZeev'))
    const itemText = firstField(fmap, ITEM_DESC_FIELDS)
    if (looksTruncatedZeevText(serviceDesc) || genericPurchaseText(itemText)) {
      try {
        const messages = await zeevMessages(id)
        const messageDesc = bestMessageDescription(messages, serviceDesc, itemText)
        if (messageDesc) {
          mergedFields = mergeFields(mergedFields, [{ name: 'descricaoMensagemZeev', value: messageDesc, row: 1, source: 'messages' }])
        }
        ;(detail as AnyRecord).__messages = messages
      } catch (error) {
        errors.push({ field: '__messages__', error: error instanceof Error ? error.message : String(error) })
      }
    }
  }
  return {
    ...row,
    ...detail,
    formFields: mergedFields,
    instanceTasks: Array.isArray(detail.instanceTasks) ? detail.instanceTasks : row.instanceTasks,
    __enrichmentErrors: errors,
  }
}

async function sendEmail(ticket: AnyRecord) {
  const to = env('ZEEV_NOTIFY_EMAIL', 'eduardo.falcao@raizeducacao.com.br')
  const resend = env('RESEND_API_KEY')
  const from = env('ZEEV_EMAIL_FROM', 'Raiz ObraViva <onboarding@resend.dev>')
  const subject = `Novo Ticket Raiz CAPEX #${ticket.zeev_instance_id}`
  const link = ticket.ticket_link || ''
  const html = `
    <div style="font-family:Arial,sans-serif;color:#173C34;line-height:1.5">
      <h2 style="margin:0 0 12px">Novo Ticket Raiz marcado como CAPEX</h2>
      <p><b>Ticket:</b> ${ticket.zeev_instance_id}</p>
      <p><b>Fluxo:</b> ${ticket.flow_name || ticket.request_name || ''}</p>
      <p><b>Solicitante:</b> ${ticket.requester_name || ''}</p>
      <p><b>Etapa atual:</b> ${ticket.etapa_atual || 'Nao informada'}</p>
      ${link ? `<p><a href="${link}">Abrir Ticket Raiz</a></p>` : ''}
      <p>O ticket ja esta aguardando analise na fila de CAPEX da Raiz ObraViva.</p>
    </div>`
  if (resend) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resend}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!res.ok) return { sent: false, reason: `Resend: ${await res.text()}` }
    return { sent: true, provider: 'resend' }
  }

  const brevo = env('BREVO_API_KEY')
  if (brevo) {
    const senderEmail = env('BREVO_SENDER_EMAIL') || env('ZEEV_EMAIL_FROM_ADDRESS')
    const senderName = env('BREVO_SENDER_NAME', 'Raiz ObraViva')
    if (!senderEmail) return { sent: false, reason: 'BREVO_SENDER_EMAIL ausente' }
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevo,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    })
    if (!res.ok) return { sent: false, reason: `Brevo: ${await res.text()}` }
    return { sent: true, provider: 'brevo' }
  }

  return { sent: false, reason: 'RESEND_API_KEY ou BREVO_API_KEY ausente' }
}

async function notifyNewTickets(tickets: AnyRecord[], existing: Map<number, AnyRecord>) {
  const notified: number[] = []
  const failed: AnyRecord[] = []
  for (const ticket of tickets) {
    const old = existing.get(Number(ticket.zeev_instance_id))
    if (old?.email_notified_at) continue
    if (old && old.status !== 'pendente') continue
    const result = await sendEmail(ticket)
    if (result.sent) {
      notified.push(Number(ticket.zeev_instance_id))
      await rest(`/capex_zeev_solicitacoes?zeev_instance_id=eq.${Number(ticket.zeev_instance_id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ email_notified_at: new Date().toISOString() }),
      })
    } else failed.push({ id: ticket.zeev_instance_id, reason: result.reason })
  }
  return { notified, failed }
}

function emailWarningText(email: { notified?: unknown[]; failed?: AnyRecord[] } | null | undefined, shouldNotify: boolean) {
  const failed = Array.isArray(email?.failed) ? email.failed : []
  if (!shouldNotify || !failed.length) return null
  const reasons = [...new Set(failed.map((f) => String(f?.reason || 'falha nao informada')).filter(Boolean))]
    .slice(0, 3)
    .join(' | ')
  return `Aviso de e-mail: ${failed.length} ticket(s) sem notificacao (${reasons || 'motivo nao informado'}). A captura Zeev foi concluida.`
}

function syncStateMessage(errors: string[], email: { notified?: unknown[]; failed?: AnyRecord[] } | null | undefined, shouldNotify: boolean) {
  const parts = [
    ...errors.map((e) => String(e || '').trim()).filter(Boolean),
    emailWarningText(email, shouldNotify),
  ].filter(Boolean)
  return parts.length ? parts.join(' | ').slice(0, 1500) : null
}

async function runSync(input: AnyRecord) {
  const stateId = 'zeev-capex'
  const now = new Date()
  const mode = input.mode || 'incremental'
  const state = await getState(stateId)
  const lockTtlMinutes = positiveNumber(input.lockTtlMinutes || input.lock_ttl_minutes || env('ZEEV_SYNC_LOCK_TTL_MINUTES', '15'), 15)
  const freshLock = freshRunningLock(state, lockTtlMinutes)
  if (freshLock) {
    return {
      ok: true,
      mode,
      skipped: true,
      reason: 'Sincronizacao Zeev ja esta em andamento.',
      runningSince: freshLock.updated_at,
      lockTtlMinutes,
    }
  }
  const overlapHours = Number(input.overlapHours || env('ZEEV_SYNC_OVERLAP_HOURS', '12')) || 12
  const start =
    input.start ||
    (mode === 'retro'
      ? '2026-04-01T00:00:00-03:00'
      : state?.last_success_at
        ? new Date(new Date(state.last_success_at).getTime() - overlapHours * 60 * 60 * 1000).toISOString()
        : new Date(now.getTime() - overlapHours * 60 * 60 * 1000).toISOString())
  const end =
    input.end ||
    (mode === 'retro'
      ? '2026-07-01T23:59:59-03:00'
      : new Date(now.getTime() + 5 * 60 * 1000).toISOString())
  const flows = String(input.flowIds || env('ZEEV_FLOW_IDS') || DEFAULT_FLOW_IDS.join(','))
    .split(',')
    .map((v) => Number(v.trim()))
    .filter(Boolean)
  const maxPages = Number(input.maxPages || env('ZEEV_MAX_PAGES', '1000')) || 1000
  const shouldNotify = input.notify === true || (mode !== 'retro' && input.notify !== false)

  await saveState(stateId, { running: true, last_error: null, last_start_date: start, last_end_date: end })

  const allTickets: AnyRecord[] = []
  const errors: string[] = []
  try {
    for (const flow of flows) {
      let flowHadSuccessfulPage = false
      for (let page = 1; page <= maxPages; page++) {
        let report: { rows: AnyRecord[]; pageSize: number }
        try {
          report = await zeevReport(flow, page, start, end)
          flowHadSuccessfulPage = true
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          errors.push(String(msg).slice(0, 900))
          break
        }
        const rows = report.rows
        for (const row of rows) {
          if (!capexField(Array.isArray(row?.formFields) ? row.formFields : [])) continue
          const enriched = await enrichRow(row)
          const ticket = await buildTicket(enriched)
          if (ticket) allTickets.push(ticket)
        }
        if (rows.length < report.pageSize) break
      }
      if (!flowHadSuccessfulPage) errors.push(`Fluxo ${flow} nao retornou nenhuma pagina valida.`)
    }

    if (allTickets.length === 0 && errors.length >= flows.length) {
      throw new Error(`Nenhum fluxo Zeev retornou pagina valida: ${errors.join(' | ').slice(0, 1500)}`)
    }

    const unique = new Map<number, AnyRecord>()
    for (const ticket of allTickets) unique.set(Number(ticket.zeev_instance_id), ticket)
    const tickets = [...unique.values()].sort((a, b) => Number(b.zeev_instance_id) - Number(a.zeev_instance_id))
    const existing = await getExisting(tickets.map((t) => Number(t.zeev_instance_id)))
    const saved = await upsertTickets(tickets)
    const reconcile = await reconcileRegisteredTickets(tickets)
    const newCount = tickets.filter((t) => !existing.has(Number(t.zeev_instance_id))).length
    const email = shouldNotify ? await notifyNewTickets(tickets, existing) : { notified: [], failed: [] }

    await saveState(stateId, {
      running: false,
      last_success_at: now.toISOString(),
      last_error: syncStateMessage(errors, email, shouldNotify),
      last_run_found: tickets.length,
      last_run_new: newCount,
      last_run_updated: Math.max(0, saved.length - newCount),
    })

    return {
      ok: true,
      mode,
      start,
      end,
      flows,
      found: tickets.length,
      new: newCount,
      updated: Math.max(0, saved.length - newCount),
      linkedRegistered: reconcile.capexLinked,
      matchedPayments: reconcile.paymentMatched,
      notified: email.notified.length,
      emailFailures: email.failed,
      warnings: errors,
      ticketIds: input.verbose ? tickets.map((t) => t.zeev_instance_id) : undefined,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    errors.push(msg)
    await saveState(stateId, { running: false, last_error: msg })
    throw error
  }
}

async function runIngest(input: AnyRecord) {
  const tickets = Array.isArray(input.tickets) ? input.tickets : []
  if (!tickets.length) {
    await saveState('zeev-capex', {
      running: false,
      last_success_at: new Date().toISOString(),
      last_error: null,
      last_run_found: 0,
      last_run_new: 0,
      last_run_updated: 0,
    })
    return { ok: true, mode: 'ingest', found: 0, new: 0, updated: 0, notified: 0 }
  }
  const normalized = await Promise.all(tickets
    .filter((t: AnyRecord) => Number(t?.zeev_instance_id))
    .map(async (t: AnyRecord) => {
      const campos = { ...(t.campos_extraidos || {}) }
      const pedido = cleanSummaryText(t.pedido || '')
      const items = Array.isArray(t.itens_json) ? t.itens_json : []
      const compra = String(t.setor || '').toUpperCase() === 'COMPRAS' || String(t.flow_name || t.request_name || '').toLowerCase().includes('compra')
      const existingSummary = cleanSummaryText(campos._resumo_card || '')
      const existingSummarySource = String(campos._resumo_card_source || '')
      if (pedido && (!existingSummary || existingSummary === pedido || ['deterministico', 'texto-completo'].includes(existingSummarySource))) {
        const resumo = await cardSummaryCascade(pedido, items, compra)
        if (resumo.text) {
          campos._resumo_card = resumo.text
          campos._resumo_card_source = resumo.source
          campos._pedido_completo_chars = pedido.length
        }
      }
      return { ...t, campos_extraidos: campos, last_seen_at: new Date().toISOString() }
    }))
  const existing = await getExisting(normalized.map((t: AnyRecord) => Number(t.zeev_instance_id)))
  const saved = await upsertTickets(normalized)
  const reconcile = await reconcileRegisteredTickets(normalized)
  const newCount = normalized.filter((t: AnyRecord) => !existing.has(Number(t.zeev_instance_id))).length
  const email = input.notify === true ? await notifyNewTickets(normalized, existing) : { notified: [], failed: [] }
  await saveState('zeev-capex', {
    running: false,
    last_success_at: new Date().toISOString(),
    last_error: syncStateMessage([], email, input.notify === true),
    last_run_found: normalized.length,
    last_run_new: newCount,
    last_run_updated: Math.max(0, saved.length - newCount),
  })
  return {
    ok: true,
    mode: 'ingest',
    found: normalized.length,
    new: newCount,
    updated: Math.max(0, saved.length - newCount),
    linkedRegistered: reconcile.capexLinked,
    matchedPayments: reconcile.paymentMatched,
    notified: email.notified.length,
    emailFailures: email.failed,
  }
}

async function runSyncError(input: AnyRecord) {
  const msg = String(input.error || input.message || 'Falha desconhecida na sincronizacao Zeev.').slice(0, 1500)
  await saveState('zeev-capex', {
    running: false,
    last_error: msg,
  })
  return { ok: true, mode: 'sync-error', error: msg }
}

async function dispatchGithubWorkflow(input: AnyRecord, actor: AnyRecord | null) {
  const token = env('GITHUB_SYNC_TOKEN') || env('GITHUB_TOKEN')
  if (!token) throw new Error('GITHUB_SYNC_TOKEN ausente nos secrets da Supabase.')
  const repo = env('GITHUB_REPO', 'eduardofalcaoraiz/raiz-obras')
  const workflow = env('GITHUB_ZEEV_WORKFLOW', 'zeev-capex-sync.yml')
  const ref = env('GITHUB_REF', 'main')
  const syncMode = String(input.workflowMode || input.syncMode || 'deep-incremental')
  const flowIds = String(input.flowIds || input.flow_ids || env('ZEEV_FLOW_IDS') || DEFAULT_FLOW_IDS.join(','))
  const requestedMaxPages = positiveNumber(input.maxPages || input.max_pages || (syncMode === 'retro' || syncMode === 'deep-retro' ? '999' : '12'), 12)
  const lockTtlMinutes = positiveNumber(input.lockTtlMinutes || input.lock_ttl_minutes || env('ZEEV_GITHUB_LOCK_TTL_MINUTES') || (requestedMaxPages > 2 ? '45' : '15'), requestedMaxPages > 2 ? 45 : 15)
  const requestedStart = String(input.start || '')
  const requestedEnd = String(input.end || '')
  const lock = await claimSyncLock(lockTtlMinutes, requestedStart || null, requestedEnd || null)
  if (!lock.claimed) {
    return {
      ok: true,
      mode: 'dispatch',
      skipped: true,
      reason: 'Sincronizacao Zeev ja esta em andamento; novo dispatch nao foi criado.',
      runningSince: lock.runningSince,
      lockTtlMinutes: lock.lockTtlMinutes,
      requestedBy: actor?.profile?.email || actor?.user?.email || '',
    }
  }
  let extraTicketIds = String(input.extraTicketIds || input.extra_ticket_ids || '')
  try {
    if (!extraTicketIds && syncMode !== 'retro' && input.refreshKnownTickets !== false) {
      extraTicketIds = (await knownTicketRefreshIds(input.refreshLimit || input.backfillLimit || env('ZEEV_GITHUB_REFRESH_LIMIT', '40'), parseFlowIds(flowIds))).join(',')
    }
    const workflowInputs: Record<string, string> = {
      mode: syncMode === 'retro' ? 'retro' : (syncMode === 'deep-retro' ? 'deep-retro' : 'deep-incremental'),
      start: requestedStart,
      end: requestedEnd,
      flow_ids: flowIds,
      max_pages: String(requestedMaxPages),
      notify: input.notify === false ? 'false' : 'true',
      extra_ticket_ids: extraTicketIds,
    }
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'RaizObraViva-ZeevSync',
      },
      body: JSON.stringify({ ref, inputs: workflowInputs }),
    })
    const text = await res.text()
    if (res.status !== 204) {
      await saveState('zeev-capex', {
        running: false,
        last_error: `GitHub workflow dispatch ${res.status}: ${text}`.slice(0, 1500),
      })
      throw new Error(`GitHub workflow dispatch ${res.status}: ${text}`)
    }
    await saveState('zeev-capex', {
      running: true,
      last_error: null,
      last_start_date: workflowInputs.start || null,
      last_end_date: workflowInputs.end || null,
    })
    return {
      ok: true,
      mode: 'dispatch',
      workflow,
      ref,
      syncMode: workflowInputs.mode,
      requestedBy: actor?.profile?.email || actor?.user?.email || '',
    }
  } catch (error) {
    await saveState('zeev-capex', {
      running: false,
      last_error: error instanceof Error ? error.message.slice(0, 1500) : String(error).slice(0, 1500),
    })
    throw error
  }
}

async function dispatchVercelBridge(input: AnyRecord, actor: AnyRecord | null) {
  const token = env('ZEEV_TOKEN')
  const secret = env('ZEEV_SYNC_SECRET')
  if (!token) throw new Error('ZEEV_TOKEN ausente nos secrets da Supabase.')
  if (!secret) throw new Error('ZEEV_SYNC_SECRET ausente nos secrets da Supabase.')
  const url = env('ZEEV_BRIDGE_URL', 'https://raiz-obras.vercel.app/api/zeev_capex_sync')
  const syncMode = String(input.workflowMode || input.syncMode || input.mode || 'deep-incremental')
  const body = {
    mode: syncMode === 'retro' ? 'retro' : (syncMode === 'deep-retro' ? 'deep-retro' : 'deep-incremental'),
    start: input.start || '',
    end: input.end || '',
    flowIds: input.flowIds || input.flow_ids || env('ZEEV_FLOW_IDS') || DEFAULT_FLOW_IDS.join(','),
    maxPages: input.maxPages || input.max_pages || (syncMode === 'retro' || syncMode === 'deep-retro' ? '999' : '12'),
    recordsPerPage: input.recordsPerPage || input.records_per_page || env('ZEEV_RECORDS_PER_PAGE', '30'),
    ticketIds: input.ticketIds || input.ticket_ids || input.instanceIds || input.instance_ids || '',
    extraTicketIds: input.extraTicketIds || input.extra_ticket_ids || '',
    businessTimezone: input.businessTimezone || input.business_timezone || env('ZEEV_BUSINESS_TIMEZONE', 'America/Sao_Paulo'),
    notify: input.notify !== false,
  }
  if (!body.ticketIds && !body.extraTicketIds && input.refreshKnownTickets !== false && input.backfillMissingValues !== false && syncMode !== 'retro') {
    body.extraTicketIds = await knownTicketRefreshIds(input.refreshLimit || input.backfillLimit || env('ZEEV_REFRESH_LIMIT', '8'), parseFlowIds(body.flowIds))
  }
  await saveState('zeev-capex', {
    running: true,
    last_error: null,
    last_start_date: body.start || null,
    last_end_date: body.end || null,
  })
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'x-cron-secret': secret,
      'x-zeev-token': token,
      'Content-Type': 'application/json',
      'User-Agent': 'RaizObraViva-SupabaseDispatcher',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let payload: AnyRecord = {}
  try {
    payload = text ? JSON.parse(text) : {}
  } catch (_) {
    payload = { raw: text }
  }
  if (!res.ok || payload.ok === false) {
    const msg = payload?.error || text || `HTTP ${res.status}`
    await saveState('zeev-capex', { running: false, last_error: String(msg).slice(0, 1500) })
    throw new Error(`Vercel Zeev bridge ${res.status}: ${String(msg).slice(0, 1500)}`)
  }
  return {
    ok: true,
    mode: 'dispatch',
    target: 'vercel',
    requestedBy: actor?.profile?.email || actor?.user?.email || '',
    ...payload,
  }
}

function safeZeevFileUrl(value: unknown) {
  try {
    const url = new URL(String(value || ''))
    const host = url.hostname.toLowerCase()
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (host === 'raizeducacao.zeev.it' || host.endsWith('.zeev.it') || host.includes('zeev')) return url.toString()
    return null
  } catch (_) {
    return null
  }
}

function fileNameFromResponse(url: string, headers: Headers) {
  const disp = headers.get('content-disposition') || ''
  const match = disp.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i)
  const fromHeader = match ? decodeURIComponent(match[1] || match[2] || '') : ''
  const fromUrl = url.split('/').pop()?.split('?')[0] || ''
  return (fromHeader || decodeURIComponent(fromUrl) || 'documento-fiscal.pdf').replace(/[^A-Za-z0-9._ -]+/g, '_')
}

async function runFileProxy(input: AnyRecord) {
  const url = safeZeevFileUrl(input?.url)
  if (!url) return json({ ok: false, error: 'URL Zeev invalida.' }, 400)
  const token = env('ZEEV_TOKEN')
  if (!token) return json({ ok: false, error: 'ZEEV_TOKEN ausente nos secrets da Supabase.' }, 500)
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: '*/*',
      'User-Agent': 'RaizObraViva/1.0 (+https://raiz-obras.vercel.app)',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    return json({ ok: false, error: text.slice(0, 500) || `HTTP ${res.status}` }, res.status === 404 ? 404 : 502)
  }
  const body = await res.arrayBuffer()
  return new Response(body, {
    status: 200,
    headers: {
      ...CORS,
      'Cache-Control': 'no-store',
      'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileNameFromResponse(url, res.headers)}"`,
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'Use POST.' }, 405)

  try {
    const input = await req.json().catch(() => ({}))
    if (input?.mode === 'ingest') {
      if (!secretAuthorized(req)) return json({ ok: false, error: 'Nao autorizado.' }, 401)
      if (!env('ZEEV_SYNC_SECRET')) return json({ ok: false, error: 'ZEEV_SYNC_SECRET nao configurado.' }, 500)
      const out = await runIngest(input || {})
      return json(out)
    }
    if (input?.mode === 'sync-error') {
      if (!secretAuthorized(req)) return json({ ok: false, error: 'Nao autorizado.' }, 401)
      const out = await runSyncError(input || {})
      return json(out)
    }
    if (input?.mode === 'dispatch') {
      const actor = secretAuthorized(req) ? null : await requireAppUser(req)
      const out = input?.target === 'github' ? await dispatchGithubWorkflow(input || {}, actor) : await dispatchVercelBridge(input || {}, actor)
      return json(out)
    }
    if (input?.mode === 'file-proxy') {
      await requireAppUser(req)
      return await runFileProxy(input || {})
    }
    if (!secretAuthorized(req)) return json({ ok: false, error: 'Nao autorizado.' }, 401)
    const out = await runSync(input || {})
    return json(out)
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
