const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-webhook-secret, x-zeev-token, x-zeev-extra-tokens, x-zeev-extra-document-fields, x-zeev-file-download-url-template',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type AnyRecord = Record<string, any>

const DEFAULT_FLOW_IDS = [299, 275, 263, 102, 300]
const FINANCE_FLOW_IDS = new Set([299, 275, 263, 110])
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
  'Informa\u00e7\u00f5es referentes \u00e0 solicita\u00e7\u00e3o',
  'Informa\u00e7\u00f5es referentes a solicita\u00e7\u00e3o',
  'Informacoes referentes \u00e0 solicita\u00e7\u00e3o',
  'Informa\u00e7\u00f5es',
  'Informações',
]
const PURCHASE_SERVICE_DESCRIPTION_FIELDS = [
  'descricaoMensagemZeev',
  'descricaoDoServico',
  'descricaoServico',
  'descricaoServicoSolicitado',
  'descricaoServicoCompra',
  'descricao do servico',
  'Descri\u00e7\u00e3o',
  'Descricao',
  'Desc do Servi\u00e7o',
  'Desc do Servico',
  'Descri\u00e7\u00e3o do Servi\u00e7o',
  'Descricao do Servico',
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
  'Lista para cota\u00e7\u00e3o',
  'Item / Medicamento',
  'Item',
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
  'Valor total do pagamento *',
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
  'Total dos itens',
  'Total dos itens *',
  'Total das parcelas',
  'Total das parcelas *',
  'Total do pag.',
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
const FISCAL_NUMBER_FIELDS = ['numeroNF', 'numeroNotaFiscal', 'n\u00famero', 'numero', 'N\u00famero', 'Numero']
const ISSUE_DATE_FIELDS = ['dataEmissao', 'data de emissao', 'data de emiss\u00e3o', 'Data de emiss\u00e3o', 'Data de emiss\u00e3o *']
const DESTINATION_UNIT_FIELDS = [
  'Unidade / Filial',
  'Unidade / Filial *',
  'Unidade / Filial de destino',
  'Unidade / Filial de destino *',
  'Filial/unidade de destino',
  'Filial/unidade de destino *',
  'Filial Solic.',
  'Filial Dest.',
]
const COMPANY_FIELDS = [
  'Coligada',
  'Coligada *',
  'Coligada de destino',
  'Coligada de destino *',
  'Col. Solic.',
  'Col. Dest.',
]
const ITEM_UNIT_MEASURE_FIELDS = ['unidadeMedida', 'unidade medida', 'unidade', 'un']
const ITEM_UNIT_FIELDS = ['precoUnitario', 'preço unitário', 'preco unitario', 'valorUnitario', 'valor unitario', 'valor un']
const ITEM_TOTAL_FIELDS = ['valorTotalItem', 'valor total item', 'valor total do item', 'precoTotal', 'preço total', 'valorProduto', 'valor do produto', 'valorServico', 'valor do serviço']

const DOCUMENT_FIELDS = [
  'anexo',
  'anexos',
  'arquivo',
  'arquivos',
  'Arquivo',
  'Arquivos',
  'anexarNotaFiscal',
  'anexarBoletoAVista',
  'anexarBoletoParcelado',
  'arquivoNF',
  'arquivo NF',
  'arquivoNf',
  'arquivoNFS',
  'arquivoNFSe',
  'arquivoNFe',
  'notaFiscal',
  'NotaFiscal',
  'nota fiscal',
  'notaFiscalArquivo',
  'notaFiscalServico',
  'notaFiscalServicos',
  'notaFiscalDeServico',
  'notaFiscalDeServicos',
  'notaFiscalPagamento',
  'notaFiscalAnexo',
  'arquivoNotaFiscal',
  'anexoNotaFiscal',
  'anexoNF',
  'anexoNf',
  'anexoNFS',
  'anexoNFSe',
  'nF',
  'nf',
  'nfs',
  'nfse',
  'nfe',
  'nfsE',
  'documento',
  'Documento',
  'documentos',
  'Documentos',
  'documentoFiscal',
  'DocumentoFiscal',
  'documento fiscal',
  'documentoNF',
  'documentoNf',
  'documentoNFS',
  'documentoNFSe',
  'documentoNFe',
  'documentoNotaFiscal',
  'documentoPagamento',
  'arquivoDocumento',
  'anexoDocumento',
  'danfe',
  'DANFE',
  'xml',
  'XML',
  'pdf',
  'PDF',
  'comprovante',
  'Comprovante',
  'comprovantePagamento',
  'comprovante pagamento',
  'comprovanteAnexo',
  'arquivoComprovante',
  'documentoComprovante',
  'boleto',
  'Boleto',
  'pix',
  'Pix',
  'recibo',
  'Recibo',
  'fatura',
  'Fatura',
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
  'valorTotalDoPagamento01',
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
  'cgc',
  'cnpjFornecedor',
  'cnpjCpfDoFornecedor',
  'cnpjDoFornecedor',
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
  'numeroDaNF',
  'serieDaNF',
  'numeroNotaFiscal',
  'valorNotaFiscal',
  'chaveAcesso',
  'chaveDeAcesso',
  'Informe a chave de acesso',
  ...DOCUMENT_FIELDS,
  ...PURCHASE_SERVICE_DESCRIPTION_FIELDS,
  ...PURCHASE_ITEM_DESCRIPTION_FIELDS,
  ...DESTINATION_UNIT_FIELDS,
  ...COMPANY_FIELDS,
]

const FINANCE_ENRICH_FIELDS = [
  'investimentoCAPEX',
  'valorTotalDoPagamento',
  'valorTotalDoPagamento01',
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
  'Data de vencimento',
  'Data de vencimento *',
  'Data de vencimento extra\u00edda',
  ...ISSUE_DATE_FIELDS,
  'formaPagamento',
  'formaDePagamento',
  'Forma de pagamento',
  'Forma de pagamento *',
  'Condi\u00e7\u00e3o de pagamento',
  'Condi\u00e7\u00e3o de pagamento *',
  'condicaoPagamento',
  'favorecido',
  'beneficiario',
  'fornecedor',
  'Fornecedor',
  'Fornecedor *',
  'nomeFornecedor',
  'razaoSocial',
  'cnpj',
  'cgc',
  'cnpjFornecedor',
  'centroDeCusto',
  'codigoDoCentroDeCusto',
  'centroCusto',
  'Centro de Custo',
  'Centro de Custo *',
  'unidade',
  'unidadeEscolar',
  'escola',
  'filial',
  'marca',
  'descricao',
  'Descri\u00e7\u00e3o da Nota Fiscal',
  'Descri\u00e7\u00e3o da Nota Fiscal *',
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
  'numeroDaNF',
  'serieDaNF',
  'numeroNotaFiscal',
  ...FISCAL_NUMBER_FIELDS,
  'valorNotaFiscal',
  'chaveAcesso',
  'chaveDeAcesso',
  'Informe a chave de acesso',
  ...DOCUMENT_FIELDS,
  ...FINANCE_DESCRIPTION_FIELDS,
  ...DESTINATION_UNIT_FIELDS,
  ...COMPANY_FIELDS,
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

function envFlag(name: string, fallback = '') {
  return ['1', 'true', 'sim', 'yes', 'on'].includes(String(env(name, fallback) || '').trim().toLowerCase())
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientSupabaseError(status: number, text = '') {
  return [429, 500, 502, 503, 504, 520, 521, 522, 524, 546].includes(Number(status))
    || /PGRST002|schema cache|Connection timed out|Web server is down|WORKER_RESOURCE_LIMIT/i.test(String(text || ''))
}

function automationModeCanPause(mode: unknown) {
  const key = normKey(mode)
  return [
    'dispatch',
    'ingest',
    'syncerror',
    'backfilldocs',
    'docrescuecandidates',
    'docrescueaudit',
    'refreshpaymentstatuses',
    'webhook',
    'webhookticket',
    'health',
  ].includes(key)
}

function automationPaused(mode: unknown) {
  return envFlag('ZEEV_AUTOMATION_PAUSED') && automationModeCanPause(mode)
}

let REQUEST_ZEEV_TOKEN = ''
let REQUEST_ZEEV_EXTRA_TOKENS = ''
let REQUEST_ZEEV_EXTRA_DOCUMENT_FIELDS = ''
let REQUEST_ZEEV_FILE_DOWNLOAD_URL_TEMPLATE = ''

const BAD_ZEEV_TOKENS = new Set<string>()

function requestListInput(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean).join(',')
  return String(value || '').trim()
}

function tokenListInput(value: unknown) {
  const out: string[] = []
  const add = (token: string) => {
    const clean = String(token || '').trim()
    if (clean && !out.includes(clean)) out.push(clean)
  }
  if (Array.isArray(value)) {
    for (const item of value) tokenListInput(item).forEach(add)
    return out
  }
  const raw = String(value || '').trim()
  if (!raw) return out
  const joinedWrappedToken = raw.replace(/\s+/g, '')
  if (joinedWrappedToken && joinedWrappedToken !== raw) add(joinedWrappedToken)
  parseListEnv(raw).forEach(add)
  return out
}

function tokenVariants(token: string) {
  const variants = [token]
  try {
    const decoded = decodeURIComponent(token)
    if (decoded && decoded !== token) variants.push(decoded)
  } catch (_) {
    // Some Zeev tokens arrive already decoded; keep the original in that case.
  }
  return variants
}

function zeevTokens() {
  const tokens: string[] = []
  for (const raw of [REQUEST_ZEEV_TOKEN, env('ZEEV_TOKEN'), REQUEST_ZEEV_EXTRA_TOKENS, env('ZEEV_EXTRA_TOKENS')]) {
    for (const token of tokenListInput(raw)) {
      for (const variant of tokenVariants(token)) {
        if (variant && !tokens.includes(variant)) tokens.push(variant)
      }
    }
  }
  return tokens
}

function zeevExtraTokensString() {
  return zeevTokens().slice(1).join('\n')
}

function zeevToken() {
  return zeevTokens()[0] || ''
}

function hasFormFields(data: unknown) {
  if (Array.isArray(data)) return data.some((row) => Array.isArray(row?.formFields) && row.formFields.length > 0)
  return !!(data && typeof data === 'object' && Array.isArray((data as AnyRecord).formFields) && (data as AnyRecord).formFields.length > 0)
}

function mergeZeevRows(rows: AnyRecord[]) {
  const map = new Map<string, AnyRecord>()
  for (const row of rows || []) {
    if (!row || typeof row !== 'object') continue
    const key = String(row.id || row.instanceId || row.zeev_instance_id || `row-${map.size}`)
    const prev = map.get(key)
    if (!prev) {
      map.set(key, row)
      continue
    }
    map.set(key, {
      ...prev,
      ...row,
      formFields: mergeFields(prev.formFields || [], row.formFields || []),
    })
  }
  return [...map.values()]
}

function zeevRequestTimeoutMs(value?: unknown) {
  return Math.max(5000, Math.min(Number(value || env('ZEEV_API_TIMEOUT_MS', '12000')) || 12000, 60000))
}

async function zeevFetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs?: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), zeevRequestTimeoutMs(timeoutMs))
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function zeevJsonRequest(url: string, init: RequestInit = {}, options: { needsFormFields?: boolean; mergeRows?: boolean; timeoutMs?: number } = {}): Promise<any> {
  const tokens = zeevTokens().filter((token) => token && !BAD_ZEEV_TOKENS.has(token))
  if (!tokens.length) throw new Error('ZEEV_TOKEN ausente nos secrets da Supabase.')
  const errors: string[] = []
  const rows: AnyRecord[] = []
  let fallback: unknown = null
  let fallbackSet = false

  for (const token of tokens) {
    const headers = new Headers(init.headers || {})
    headers.set('Authorization', `Bearer ${token}`)
    if (!headers.has('Accept')) headers.set('Accept', 'application/json')
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

    let res: Response
    try {
      res = await zeevFetchWithTimeout(url, { ...init, headers }, options.timeoutMs)
    } catch (error) {
      errors.push(`timeout/fetch: ${error instanceof Error ? error.message : String(error)}`.slice(0, 260))
      continue
    }
    const text = await res.text()
    if (!res.ok) {
      if (res.status === 401) BAD_ZEEV_TOKENS.add(token)
      errors.push(`HTTP ${res.status}: ${text.slice(0, 220)}`)
      if ([401, 403].includes(res.status) || res.status >= 500) continue
      throw new Error(`Zeev API ${res.status}: ${text.slice(0, 500)}`)
    }

    const data = text ? JSON.parse(text) : {}
    if (options.mergeRows) {
      rows.push(...(Array.isArray(data) ? data : [data]))
      continue
    }
    if (options.needsFormFields && !hasFormFields(data)) {
      if (!fallbackSet) {
        fallback = data
        fallbackSet = true
      }
      continue
    }
    return data
  }

  if (options.mergeRows && rows.length) return mergeZeevRows(rows)
  if (fallbackSet) return fallback
  throw new Error(`Zeev API sem resposta autorizada: ${errors.join(' | ')}`)
}

async function zeevTextRequest(url: string, init: RequestInit = {}): Promise<{ res: Response; text: string }> {
  const tokens = zeevTokens().filter((token) => token && !BAD_ZEEV_TOKENS.has(token))
  if (!tokens.length) throw new Error('ZEEV_TOKEN ausente nos secrets da Supabase.')
  const errors: string[] = []
  for (const token of tokens) {
    const headers = new Headers(init.headers || {})
    headers.set('Authorization', `Bearer ${token}`)
    if (!headers.has('Accept')) headers.set('Accept', '*/*')
    let res: Response
    try {
      res = await zeevFetchWithTimeout(url, { ...init, headers })
    } catch (error) {
      errors.push(`timeout/fetch: ${error instanceof Error ? error.message : String(error)}`.slice(0, 260))
      continue
    }
    const text = await res.text()
    if (res.ok) return { res, text }
    if (res.status === 401) BAD_ZEEV_TOKENS.add(token)
    errors.push(`HTTP ${res.status}: ${text.slice(0, 220)}`)
    if (![401, 403].includes(res.status) && res.status < 500) break
  }
  throw new Error(`Zeev API sem resposta autorizada: ${errors.join(' | ')}`)
}

async function zeevBinaryRequest(url: string, init: RequestInit = {}, options: { timeoutMs?: number; maxTokens?: number } = {}): Promise<Response> {
  const tokens = zeevTokens().filter((token) => token && !BAD_ZEEV_TOKENS.has(token))
  if (!tokens.length) throw new Error('ZEEV_TOKEN ausente nos secrets da Supabase.')
  const errors: string[] = []
  const maxTokens = Math.max(1, Math.min(Number(options.maxTokens || tokens.length) || tokens.length, tokens.length))
  for (const token of tokens.slice(0, maxTokens)) {
    const headers = new Headers(init.headers || {})
    headers.set('Authorization', `Bearer ${token}`)
    if (!headers.has('Accept')) headers.set('Accept', '*/*')
    let res: Response
    try {
      res = await zeevFetchWithTimeout(url, { ...init, headers }, options.timeoutMs)
    } catch (error) {
      errors.push(`timeout/fetch: ${error instanceof Error ? error.message : String(error)}`.slice(0, 260))
      continue
    }
    if (res.ok) return res
    const text = await res.text()
    if (res.status === 401) BAD_ZEEV_TOKENS.add(token)
    errors.push(`HTTP ${res.status}: ${text.slice(0, 220)}`)
    if (![401, 403].includes(res.status) && res.status < 500) break
  }
  throw new Error(`Zeev arquivo sem resposta autorizada: ${errors.join(' | ')}`)
}

function secretAuthorized(req: Request) {
  const configuredSecrets = [env('ZEEV_SYNC_SECRET'), env('ZEEV_DB_CRON_SECRET'), env('ZEEV_WEBHOOK_SECRET')].filter(Boolean)
  if (!configuredSecrets.length) return false
  const url = new URL(req.url)
  const got = req.headers.get('x-cron-secret') || req.headers.get('x-webhook-secret') || ''
  const auth = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const querySecret =
    url.searchParams.get('x-cron-secret') ||
    url.searchParams.get('cron_secret') ||
    url.searchParams.get('cronSecret') ||
    url.searchParams.get('sync_secret') ||
    url.searchParams.get('syncSecret') ||
    url.searchParams.get('webhook_secret') ||
    url.searchParams.get('webhookSecret') ||
    ''
  return configuredSecrets.includes(got) || configuredSecrets.includes(auth) || configuredSecrets.includes(querySecret)
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
  const result = norm(row?.flowResult || row?.flow_result || row?.raw_instance?.flowResult || row?.rawInstance?.flowResult || '')
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
  const name = norm(row?.flow?.name || row?.flowName || row?.flow_name || row?.requestName || row?.request_name || row?.raw_instance?.flow?.name || row?.raw_instance?.flowName || '')
  return name.includes('solicitacao de compras') || name.includes('solicitacoes de compras')
}

function isFinanceiro(row: AnyRecord) {
  const name = norm(row?.flow?.name || row?.flowName || row?.flow_name || row?.requestName || row?.request_name || row?.raw_instance?.flow?.name || row?.raw_instance?.flowName || '')
  return name.includes('solicitacao financeira') || name.includes('solicitacoes financeiras') || name.includes('financeiro')
}

function flowId(row: AnyRecord) {
  return Number(row?.flow?.id || row?.flowId || row?.flow_id || row?.raw_instance?.flow?.id || row?.raw_instance?.flowId || 0) || null
}

function flowName(row: AnyRecord) {
  return String(row?.flow?.name || row?.flowName || row?.flow_name || row?.requestName || row?.request_name || row?.raw_instance?.flow?.name || row?.raw_instance?.flowName || '').trim()
}

function flowVersion(row: AnyRecord) {
  return Number(row?.flow?.version || row?.flowVersion || row?.flow_version || row?.raw_instance?.flow?.version || row?.raw_instance?.flowVersion || 0) || null
}

function capexFieldsForFlow(flow: number) {
  if (FINANCE_FLOW_IDS.has(flow)) return ['investimentoCAPEX', 'É um investimento (CAPEX)?', 'E um investimento (CAPEX)?', 'CAPEX']
  if (flow === 102 || flow === 300) return ['cAPEX', 'CAPEX', 'Investimento CAPEX']
  return CAPEX_FIELDS
}

function parseListEnv(value: unknown) {
  return String(value || '')
    .split(/[\n,;|]+/)
    .map((v) => v.trim())
    .filter(Boolean)
}

function looksLikeRelevantDesignField(field: AnyRecord) {
  const hay = normKey([field?.name, field?.label, field?.typeName, field?.validationName, field?.groupName].filter(Boolean).join(' '))
  return /(capex|notafiscal|nfse|nfe|nfs|danfe|xml|pdf|arquivo|anexo|documento|fatura|boleto|comprovante|recibo|pix|file|upload|visualizador|valor|pagamento|parcela|fornecedor|favorecido|beneficiario|razaosocial|cnpj|cpf|cgc|chavedeacesso|numerodanf|numeronf|serie|dataemissao|vencimento|previsao|centrodecusto|codigodocentrodecusto|coligada|unidade|filial|solicitante|email|informacoes|justificativa|descricao|servico|item|produto|material|quantidade|frete)/.test(hay)
}

function walkJsonObjects(value: unknown): AnyRecord[] {
  const out: AnyRecord[] = []
  const visit = (item: unknown) => {
    if (Array.isArray(item)) {
      for (const nested of item) visit(nested)
      return
    }
    if (!item || typeof item !== 'object') return
    const obj = item as AnyRecord
    out.push(obj)
    for (const nested of Object.values(obj)) visit(nested)
  }
  visit(value)
  return out
}

const FLOW_DESIGN_FIELD_CACHE = new Map<number, string[]>()

async function zeewFlowDesignDocumentFields(flow: number) {
  if (!flow) return []
  if (FLOW_DESIGN_FIELD_CACHE.has(flow)) return FLOW_DESIGN_FIELD_CACHE.get(flow) || []
  if (!zeevToken()) {
    FLOW_DESIGN_FIELD_CACHE.set(flow, [])
    return []
  }
  const base = env('ZEEV_BASE_URL', 'https://raizeducacao.zeev.it').replace(/\/$/, '')
  try {
    const data = await zeevJsonRequest(`${base}/api/2/flows/${flow}/design/form`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RaizObraViva/1.0 (+https://raiz-obras.vercel.app)',
      },
    })
    const fields = walkJsonObjects(data)
      .filter((field: AnyRecord) => looksLikeRelevantDesignField(field))
      .flatMap((field: AnyRecord) => field?.name ? [field?.name, field?.label] : [field?.label])
      .map((value: unknown) => String(value || '').trim())
      .filter(Boolean)
    const unique = [...new Set(fields)]
    FLOW_DESIGN_FIELD_CACHE.set(flow, unique)
    return unique
  } catch (error) {
    console.warn(`Zeev design/form flow ${flow}:`, error instanceof Error ? error.message : String(error))
    FLOW_DESIGN_FIELD_CACHE.set(flow, [])
    return []
  }
}

async function enrichFieldsForFlow(flow: number) {
  const base = FINANCE_FLOW_IDS.has(flow) ? FINANCE_ENRICH_FIELDS : PURCHASE_ENRICH_FIELDS
  const configuredDocs = parseListEnv([env('ZEEV_EXTRA_DOCUMENT_FIELDS'), REQUEST_ZEEV_EXTRA_DOCUMENT_FIELDS].filter(Boolean).join(','))
  const designDocs = await zeewFlowDesignDocumentFields(flow)
  return [...new Set([...capexFieldsForFlow(flow), ...base, ...configuredDocs, ...designDocs])]
}

async function documentFieldsForFlow(flow: number) {
  const configuredDocs = parseListEnv([env('ZEEV_EXTRA_DOCUMENT_FIELDS'), REQUEST_ZEEV_EXTRA_DOCUMENT_FIELDS].filter(Boolean).join(','))
  const designDocs = envFlag('ZEEV_DOC_DESIGN_FIELDS_ENABLED')
    ? (await zeewFlowDesignDocumentFields(flow)).filter((field) => looksLikeZeevDocumentLabel(field))
    : []
  return [...new Set([...DOCUMENT_FIELDS, ...configuredDocs, ...designDocs])]
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

function stripHtmlToLines(html: string) {
  const normalized = String(html || '')
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, ' ')
    .replace(/<\s*style[\s\S]*?<\s*\/\s*style\s*>/gi, ' ')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|tr|li|section|article|h[1-6]|label|td|th)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  return decodeHtmlEntities(normalized)
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function splitReportLine(line: string) {
  const clean = line.replace(/\s+/g, ' ').trim()
  if (!clean || clean.length < 3) return null
  const explicit = clean.match(/^(.{2,90}?)(?:\s*[:：]\s+|\s{2,}| \* +)(.{1,6000})$/)
  if (explicit) return { label: explicit[1].replace(/\s*\*$/, '').trim(), value: explicit[2].trim() }
  const knownLabels = [
    'Valor total do pagamento',
    'Informações referentes à solicitação',
    'Informacoes referentes a solicitacao',
    'Justificativa do pedido',
    'Descrição do serviço',
    'Descricao do servico',
    'Lista para cotação',
    'Lista para cotacao',
    'Documento',
    'CAPEX',
    'É um investimento (CAPEX)?',
    'E um investimento (CAPEX)?',
    'Centro de custo',
    'CNPJ',
  ]
  const cleanNorm = norm(clean)
  for (const label of knownLabels) {
    const labelNorm = norm(label)
    if (!cleanNorm.startsWith(labelNorm)) continue
    const rest = clean.slice(Math.min(label.length, clean.length)).replace(/^[\s:*.-]+/, '').trim()
    if (rest) return { label, value: rest }
  }
  return null
}

function reportFileFieldsFromHtml(html: string) {
  const fields: AnyRecord[] = []
  const seen = new Set<string>()
  const push = (label: string, href: string, value = '') => {
    const cleanHref = decodeHtmlEntities(String(href || '')).trim()
    const cleanLabel = htmlToPlainText(label || '').replace(/\s+/g, ' ').trim()
    const cleanValue = htmlToPlainText(value || cleanLabel || cleanHref).replace(/\s+/g, ' ').trim()
    if (!cleanHref || isZeevNavigationUrl(cleanHref, cleanLabel, 'reportLink')) return
    if (!looksLikeDownloadPath(cleanHref) && !looksLikeDownloadPath(cleanValue) && !looksLikeZeevDocumentLabel(`${cleanLabel} ${cleanValue}`)) return
    const name = cleanLabel || fileNameFromDownloadPath(cleanHref, 'documento-fiscal.pdf')
    const key = `${normKey(name)}|${cleanHref}`
    if (seen.has(key)) return
    seen.add(key)
    fields.push({ name, label: name, value: cleanValue || name, openUrl: cleanHref, row: fields.length + 1, source: 'reportLink' })
  }
  const anchorRe = /<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = anchorRe.exec(String(html || '')))) push(match[3], match[2], match[3])
  const hrefRe = /\bhref=(["'])(.*?)\1/gi
  while ((match = hrefRe.exec(String(html || '')))) push(fileNameFromDownloadPath(match[2], 'documento-fiscal.pdf'), match[2], match[2])
  return fields
}

function reportFieldsFromHtml(html: string) {
  const fields: AnyRecord[] = []
  const seen = new Set<string>()
  for (const line of stripHtmlToLines(html)) {
    const pair = splitReportLine(line)
    if (!pair) continue
    const label = pair.label.replace(/\s+/g, ' ').trim()
    const value = pair.value.replace(/\s+/g, ' ').trim()
    if (!label || !value || value === '*' || label.length > 120) continue
    const key = `${normKey(label)}|${value}`
    if (seen.has(key)) continue
    seen.add(key)
    fields.push({ name: label, label, value, row: 1, source: 'reportLink' })
  }
  for (const field of reportFileFieldsFromHtml(html)) {
    const key = `${normKey(field.name)}|${field.openUrl || field.value}`
    if (seen.has(key)) continue
    seen.add(key)
    fields.push(field)
  }
  return fields
}

async function fetchReportLinkFields(reportLink: unknown) {
  const link = String(reportLink || '').trim()
  if (!zeevToken() || !link) return { fields: [], error: '' }
  const base = env('ZEEV_BASE_URL', 'https://raizeducacao.zeev.it').replace(/\/$/, '')
  const url = link.startsWith('http') ? link : `${base}${link.startsWith('/') ? '' : '/'}${link}`
  const { res, text } = await zeevTextRequest(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/json,*/*',
      'User-Agent': 'RaizObraViva/1.0 (+https://raiz-obras.vercel.app)',
    },
  })
  return { fields: reportFieldsFromHtml(text), error: '', length: text.length, contentType: res.headers.get('Content-Type') || '' }
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

async function cardSummaryCascade(text: string, items: AnyRecord[], compra: boolean, options: { skipAi?: boolean } = {}) {
  const clean = cleanSummaryText(text)
  if (!clean) return { text: '', source: '' }
  const deterministic = deterministicCardSummary(clean, items, compra)
  if (options.skipAi) return { text: deterministic, source: 'texto-completo' }
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
  const resumo = await cardSummaryCascade(desc || '', itens, compra, { skipAi: Boolean(row.__skipSummaryAi) })
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

async function rest(path: string, init: RequestInit = {}, options: { retries?: number; timeoutMs?: number } = {}) {
  const url = `${env('SUPABASE_URL').replace(/\/$/, '')}/rest/v1${path}`
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  const retries = Math.max(0, Math.min(Number(options.retries ?? env('ZEEV_SUPABASE_REST_RETRIES', '5')), 8))
  const timeoutMs = Math.max(3000, Math.min(Number(options.timeoutMs ?? env('ZEEV_SUPABASE_REST_TIMEOUT_MS', '18000')), 60000))
  let lastError = ''
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          ...(init.headers || {}),
        },
      })
      const text = await res.text()
      if (res.ok) return text ? JSON.parse(text) : null
      lastError = `Supabase REST ${res.status}: ${text}`
      if (!isTransientSupabaseError(res.status, text) || attempt >= retries) throw new Error(lastError)
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      if (!isTransientSupabaseError(0, lastError) || attempt >= retries) throw new Error(lastError)
    } finally {
      clearTimeout(timer)
    }
    await sleep(Math.min(2500 * (attempt + 1), 15000))
  }
  throw new Error(lastError || 'Supabase REST falhou sem resposta detalhada.')
}

async function restAll(path: string, pageSize = 1000) {
  const rows: AnyRecord[] = []
  let from = 0
  while (true) {
    const sep = path.includes('?') ? '&' : '?'
    const page = await rest(`${path}${sep}limit=${pageSize}&offset=${from}`)
    const list = Array.isArray(page) ? page : []
    rows.push(...list)
    if (list.length < pageSize) break
    from += pageSize
  }
  return rows
}

async function runZeevTokenHealth() {
  const started = Date.now()
  if (!zeevToken()) return { ok: false, status: 'missing_token', error: 'ZEEV_TOKEN ausente.' }
  const instanceId = String(env('ZEEV_HEALTH_INSTANCE_ID', '151321') || '').replace(/\D+/g, '')
  if (!instanceId) return { ok: true, status: 'skipped', reason: 'ZEEV_HEALTH_INSTANCE_ID ausente' }
  try {
    const base = env('ZEEV_BASE_URL', 'https://raizeducacao.zeev.it').replace(/\/$/, '')
    const data = await zeevJsonRequest(`${base}/api/2/instances/${encodeURIComponent(instanceId)}`, {}, { timeoutMs: 9000 })
    return {
      ok: true,
      status: 'ok',
      instanceId,
      hasReportLink: Boolean(data?.reportLink),
      elapsedMs: Date.now() - started,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, status: 'unhealthy', instanceId, error: msg.slice(0, 700), elapsedMs: Date.now() - started }
  }
}

async function runHealth(input: AnyRecord = {}) {
  const started = Date.now()
  if (envFlag('ZEEV_AUTOMATION_PAUSED') && input.ignorePause !== true) {
    return { ok: true, mode: 'health', paused: true, reason: 'ZEEV_AUTOMATION_PAUSED' }
  }
  try {
    await rest('/zeev_sync_state?select=id&limit=1', {}, { retries: 0, timeoutMs: 6000 })
    const zeev = input.skipZeev === true || input.skip_zeev === true ? { ok: true, status: 'skipped' } : await runZeevTokenHealth()
    const requireZeev = input.requireZeev === true || input.require_zeev === true
    return { ok: requireZeev ? Boolean(zeev.ok) : true, mode: 'health', rest: 'ok', zeev, zeevWarning: !zeev.ok, elapsedMs: Date.now() - started }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      mode: 'health',
      rest: 'unhealthy',
      transient: isTransientSupabaseError(0, msg),
      error: msg.slice(0, 700),
      elapsedMs: Date.now() - started,
    }
  }
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
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^\d{1,7}$/.test(raw)) return raw
  const groups = raw.match(/\d+/g) || []
  for (const group of groups) {
    if (group.length >= 1 && group.length <= 7 && Number(group) > 0) return group
  }
  return ''
}

function docTicketRefs(value: unknown, options: AnyRecord = {}) {
  const raw = String(value || '').trim()
  if (!raw) return []
  const strict = options.strict === true
  const refs: string[] = []
  const add = (candidate: unknown) => {
    const id = String(candidate || '').replace(/\D+/g, '')
    if (!/^\d{1,7}$/.test(id) || Number(id) <= 0 || refs.includes(id)) return
    refs.push(id)
  }
  if (/^\d{1,7}$/.test(raw)) add(raw)
  const explicit = /\b(?:TR|TICKET(?:\s+RAIZ)?|TICKET\s+DE\s+COMPRAS|SOLICITA(?:C|Ç)[AÃ]O(?:\s+DE\s+COMPRAS)?)\s*[:#-]?\s*(\d{1,7})\b/gi
  let match: RegExpExecArray | null
  while ((match = explicit.exec(raw))) add(match[1])
  if (!strict) {
    for (const part of raw.split(/[^\d]+/g)) add(part)
  }
  return refs
}

function paymentTicketRefs(row: AnyRecord) {
  return docTicketRefs(row?.ticket_raiz)
}

function capexTicketRefs(row: AnyRecord) {
  const direct = docTicketRefs(row?.ticket_raiz_instance_id)
  if (direct.length) return direct
  return docTicketRefs(row?.referencia, { strict: true })
}

function matchedTicketRef(refs: string[], targetSet: Set<string>) {
  if (targetSet.size) return refs.find((ref) => targetSet.has(ref)) || refs[0] || ''
  return refs[0] || ''
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
  if (!tickets.length) return { capexLinked: 0, paymentMatched: 0, paymentLinked: 0 }
  const byTicket = new Map<string, AnyRecord>()
  for (const ticket of tickets || []) {
    const key = ticketDigits(ticket?.zeev_instance_id)
    if (key) byTicket.set(key, ticket)
  }
  if (!byTicket.size) return { capexLinked: 0, paymentMatched: 0, paymentLinked: 0 }

  const capexRows = await restAll('/capex_itens?select=id,referencia,ticket_raiz_instance_id,ticket_raiz_dados')
  let capexLinked = 0
  const capexMatchedKeys = new Set<string>()
  for (const row of capexRows || []) {
    const key = ticketDigits(row.ticket_raiz_instance_id || row.referencia)
    const ticket = byTicket.get(key)
    if (!ticket) continue
    capexLinked++
    capexMatchedKeys.add(key)
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

  const paymentRows = await restAll('/pagamentos?select=id,obra_id,ticket_raiz')
  let paymentMatched = 0
  let paymentLinked = 0
  for (const row of paymentRows || []) {
    const key = ticketDigits(row.ticket_raiz)
    if (capexMatchedKeys.has(key)) continue
    const ticket = byTicket.get(key)
    if (!key || !ticket) continue
    paymentMatched++
    await rest(`/capex_zeev_solicitacoes?zeev_instance_id=eq.${Number(ticket.zeev_instance_id)}&status=eq.pendente`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'aprovado',
        capex_item_id: null,
        aprovado_em: new Date().toISOString(),
        aprovado_por: 'pagamento_obra_auto',
      }),
    })
    paymentLinked++
  }
  return { capexLinked, paymentMatched, paymentLinked }
}

async function reconcileRegisteredTicketsTargeted(tickets: AnyRecord[]) {
  if (!tickets.length) return { capexLinked: 0, paymentMatched: 0, paymentLinked: 0 }
  const byTicket = new Map<string, AnyRecord>()
  for (const ticket of tickets || []) {
    const key = ticketDigits(ticket?.zeev_instance_id)
    if (key) byTicket.set(key, ticket)
  }
  const ids = [...byTicket.keys()]
  if (!ids.length) return { capexLinked: 0, paymentMatched: 0, paymentLinked: 0 }

  const capexRows: AnyRecord[] = []
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80).join(',')
    const rows = await rest(`/capex_itens?select=id,referencia,ticket_raiz_instance_id,ticket_raiz_dados&or=(ticket_raiz_instance_id.in.(${chunk}),referencia.in.(${chunk}))`)
    capexRows.push(...(rows || []))
  }

  let capexLinked = 0
  const capexMatchedKeys = new Set<string>()
  for (const row of capexRows || []) {
    const key = ticketDigits(row.ticket_raiz_instance_id || row.referencia)
    const ticket = byTicket.get(key)
    if (!ticket) continue
    capexLinked++
    capexMatchedKeys.add(key)
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

  const paymentRows: AnyRecord[] = []
  for (let i = 0; i < ids.length; i += 120) {
    const chunk = ids.slice(i, i + 120).join(',')
    const rows = await rest(`/pagamentos?select=id,obra_id,ticket_raiz&ticket_raiz=in.(${chunk})`)
    paymentRows.push(...(rows || []))
  }

  let paymentMatched = 0
  let paymentLinked = 0
  for (const row of paymentRows || []) {
    const key = ticketDigits(row.ticket_raiz)
    if (capexMatchedKeys.has(key)) continue
    const ticket = byTicket.get(key)
    if (!key || !ticket) continue
    paymentMatched++
    await rest(`/capex_zeev_solicitacoes?zeev_instance_id=eq.${Number(ticket.zeev_instance_id)}&status=eq.pendente`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'aprovado',
        capex_item_id: null,
        aprovado_em: new Date().toISOString(),
        aprovado_por: 'pagamento_obra_auto',
      }),
    })
    paymentLinked++
  }

  return { capexLinked, paymentMatched, paymentLinked }
}

async function reconcilePendingTicketsAlreadyRegistered() {
  const pending = await restAll('/capex_zeev_solicitacoes?status=eq.pendente&select=id,zeev_instance_id,ticket_link,pedido,raw_fields,itens_json,pagamento_json,campos_extraidos')
  const pendingByTicket = new Map<string, AnyRecord>()
  for (const row of pending || []) {
    const key = ticketDigits(row.zeev_instance_id)
    if (key) pendingByTicket.set(key, row)
  }
  if (!pendingByTicket.size) {
    return { ok: true, mode: 'reconcile-registered', pending: 0, capexLinked: 0, paymentLinked: 0, tickets: [] }
  }

  const capexRows = await restAll('/capex_itens?select=id,referencia,ticket_raiz_instance_id,ticket_raiz_dados')
  const paymentRows = await restAll('/pagamentos?select=id,obra_id,ticket_raiz')
  const fixed: AnyRecord[] = []
  let capexLinked = 0
  let paymentLinked = 0

  for (const row of capexRows || []) {
    const key = ticketDigits(row.ticket_raiz_instance_id || row.referencia)
    const ticket = pendingByTicket.get(key)
    if (!ticket) continue
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
    await rest(`/capex_zeev_solicitacoes?id=eq.${Number(ticket.id)}&status=eq.pendente`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'aprovado',
        capex_item_id: Number(row.id),
        aprovado_em: new Date().toISOString(),
        aprovado_por: 'capex_registrado_auto',
      }),
    })
    capexLinked++
    fixed.push({ tr: Number(ticket.zeev_instance_id), destino: 'capex', capex_item_id: Number(row.id) })
    pendingByTicket.delete(key)
  }

  for (const row of paymentRows || []) {
    const key = ticketDigits(row.ticket_raiz)
    const ticket = pendingByTicket.get(key)
    if (!ticket) continue
    await rest(`/capex_zeev_solicitacoes?id=eq.${Number(ticket.id)}&status=eq.pendente`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'aprovado',
        capex_item_id: null,
        aprovado_em: new Date().toISOString(),
        aprovado_por: 'pagamento_obra_auto',
      }),
    })
    paymentLinked++
    fixed.push({ tr: Number(ticket.zeev_instance_id), destino: 'pagamento_obra', pagamento_id: Number(row.id), obra_id: Number(row.obra_id) })
    pendingByTicket.delete(key)
  }

  return { ok: true, mode: 'reconcile-registered', pending: pendingByTicket.size, capexLinked, paymentLinked, tickets: fixed }
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

function parseTicketIdList(value: unknown) {
  return [...new Set(String(value || '')
    .split(/[,\s;]+/)
    .map((v) => Number(String(v).replace(/\D/g, '')))
    .filter(Boolean))]
}

function ticketIdsFromEventInput(input: AnyRecord) {
  const directValues = [
    input.ticketIds, input.ticket_ids, input.instanceIds, input.instance_ids,
    input.instanceId, input.instance_id, input.processInstanceId, input.process_instance_id,
    input.flowInstanceId, input.flow_instance_id, input.ticketId, input.ticket_id,
    input.requestId, input.request_id, input.tr, input.TR,
  ]
  const found: number[] = []
  for (const value of directValues) found.push(...parseTicketIdList(value))
  const keys = new Set([
    'ticketid', 'ticket_id', 'instanceid', 'instance_id',
    'processinstanceid', 'process_instance_id',
    'flowinstanceid', 'flow_instance_id',
    'requestid', 'request_id', 'tr',
  ])
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item)
      return
    }
    if (!value || typeof value !== 'object') return
    for (const [key, nested] of Object.entries(value as AnyRecord)) {
      const normalized = normKey(key)
      if (keys.has(normalized)) found.push(...parseTicketIdList(nested))
      else walk(nested)
    }
  }
  walk(input)
  return uniqueNumbers(found)
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
  if (!zeevToken()) throw new Error('ZEEV_TOKEN ausente nos secrets da Supabase.')
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
    showFinishedInstanceTasks: true,
    showPendingAssignees: true,
    allowOpenUrlsForFilesInForm: true,
  })
  const request = async (formFieldNames: string[], pageSize: number, begin: string, finish: string) => {
    const body = makeBody(formFieldNames, pageSize, begin, finish)
    return await zeevJsonRequest(`${base}/api/2/instances/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'User-Agent': 'RaizObraViva/1.0 (+https://raiz-obras.vercel.app)',
      },
      body: JSON.stringify(body),
    }, { needsFormFields: true, mergeRows: true })
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
      try {
        const data = await request(flowCapexFields, pageSize, dates.begin, dates.finish)
        const rows = Array.isArray(data) ? data : [data]
        return { rows, pageSize }
      } catch (error) {
        errors.push(`size=${pageSize} begin=${dates.begin}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
  throw new Error(`Zeev report flow ${flow} page ${page}: ${errors.join(' | ')}`)
}

async function zeevInstance(instanceId: number, flow: number, fields: string[]) {
  if (!zeevToken()) throw new Error('ZEEV_TOKEN ausente nos secrets da Supabase.')
  const base = env('ZEEV_BASE_URL', 'https://raizeducacao.zeev.it').replace(/\/$/, '')
  const url = new URL(`${base}/api/2/instances/${instanceId}`)
  for (const field of fields) url.searchParams.append('formFieldNames', field)
  url.searchParams.set('showPendingInstanceTasks', 'true')
  url.searchParams.set('showFinishedInstanceTasks', 'true')
  url.searchParams.set('showPendingAssignees', 'true')
  url.searchParams.set('useCache', 'false')
  url.searchParams.set('allowOpenUrlsForFilesInForm', 'true')
  return await zeevJsonRequest(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'RaizObraViva/1.0 (+https://raiz-obras.vercel.app)',
    },
  }, { needsFormFields: Array.isArray(fields) && fields.length > 0 })
}

async function zeevInstanceReport(instanceId: number, flow: number, fields: string[]) {
  if (!zeevToken()) throw new Error('ZEEV_TOKEN ausente nos secrets da Supabase.')
  const base = env('ZEEV_BASE_URL', 'https://raizeducacao.zeev.it').replace(/\/$/, '')
  const body: AnyRecord = {
    instanceId,
    recordsPerPage: 10,
    pageNumber: 1,
    useCache: false,
    simulation: false,
    showPendingInstanceTasks: true,
    showFinishedInstanceTasks: true,
    showPendingAssignees: true,
    allowOpenUrlsForFilesInForm: true,
  }
  if (flow) body.flowId = flow
  if (Array.isArray(fields) && fields.length) body.formFieldNames = fields
  const data = await zeevJsonRequest(`${base}/api/2/instances/report`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'RaizObraViva/1.0 (+https://raiz-obras.vercel.app)',
    },
    body: JSON.stringify(body),
  }, { needsFormFields: Array.isArray(fields) && fields.length > 0, mergeRows: true })
  const rows = Array.isArray(data) ? data : [data]
  return rows.find((row: AnyRecord) => Number(row?.id) === Number(instanceId)) || rows[0] || {}
}

function knownZeevFlowIds(...values: unknown[]) {
  const ids = [
    ...DEFAULT_FLOW_IDS,
    ...Array.from(FINANCE_FLOW_IDS),
    ...parseListEnv(env('ZEEV_FLOW_IDS')).map((value) => Number(value)),
    ...values.map((value) => Number(value)),
  ].filter((value) => Number.isFinite(value) && value > 0)
  return [...new Set(ids)]
}

async function findZeevInstanceAcrossFlows(instanceId: number, preferredFlow = 0) {
  const errors: AnyRecord[] = []
  for (const flow of knownZeevFlowIds(preferredFlow)) {
    try {
      const row = await zeevInstanceReport(instanceId, flow, [])
      if (Number(row?.id) === Number(instanceId) || row?.reportLink || row?.flow || row?.flowId) {
        return { row, flow, errors }
      }
    } catch (error) {
      errors.push({ flow, error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300) })
    }
  }
  return { row: null, flow: 0, errors }
}

async function zeevMessages(instanceId: number) {
  if (!zeevToken()) throw new Error('ZEEV_TOKEN ausente nos secrets da Supabase.')
  const base = env('ZEEV_BASE_URL', 'https://raizeducacao.zeev.it').replace(/\/$/, '')
  const url = new URL(`${base}/api/2/messages/instance/${instanceId}`)
  url.searchParams.set('useCache', 'false')
  const data = await zeevJsonRequest(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'RaizObraViva/1.0 (+https://raiz-obras.vercel.app)',
    },
  })
  return Array.isArray(data) ? data : []
}

async function collectInstanceFields(instanceId: number, flow: number, fields: string[], chunkSize = 8) {
  const found: AnyRecord[] = []
  const errors: AnyRecord[] = []
  let last: AnyRecord | null = null

  const collectFrom = async (fieldSet: string[], label: string) => {
    let ok = false
    let lastData: AnyRecord | null = null
    const localErrors: string[] = []
    for (const loader of [zeevInstance, zeevInstanceReport]) {
      try {
        const data = await loader(instanceId, flow, fieldSet)
        if (Array.isArray(data.formFields)) found.push(...data.formFields)
        lastData = data
        ok = true
      } catch (error) {
        localErrors.push(error instanceof Error ? error.message : String(error))
      }
    }
    if (!ok) errors.push({ field: label, error: localErrors.join(' | ').slice(0, 1200) })
    if (lastData) last = lastData
    return ok
  }

  await collectFrom([], '__all__')

  const queryChunk = async (chunk: string[]) => {
    if (!chunk.length) return
    const ok = await collectFrom(chunk, chunk.join(','))
    if (!ok && chunk.length > 1) {
      const mid = Math.ceil(chunk.length / 2)
      await queryChunk(chunk.slice(0, mid))
      await queryChunk(chunk.slice(mid))
    }
  }

  for (let i = 0; i < fields.length; i += chunkSize) {
    await queryChunk(fields.slice(i, i + chunkSize))
  }
  return { fields: found, last, errors }
}

async function enrichRow(row: AnyRecord) {
  const flow = flowId(row) || 0
  const id = Number(row.id)
  if (!id || !flow) return row
  const fields = await enrichFieldsForFlow(flow)
  const enriched = await collectInstanceFields(id, flow, fields)
  const detail = enriched.last || row
  let mergedFields = mergeFields(Array.isArray(row.formFields) ? row.formFields : [], enriched.fields)
  const errors = [...enriched.errors]
  const reportLink = detail.reportLink || row.reportLink || detail.reportUrl || row.reportUrl || ''
  if (reportLink) {
    try {
      const report = await fetchReportLinkFields(reportLink)
      if (report.fields.length) {
        mergedFields = mergeFields(mergedFields, report.fields)
        ;(detail as AnyRecord).__reportLinkExtraction = {
          fields: report.fields.length,
          length: report.length || 0,
          contentType: report.contentType || '',
        }
      } else if (report.error) {
        errors.push({ field: '__reportLink__', error: report.error })
      }
    } catch (error) {
      errors.push({ field: '__reportLink__', error: error instanceof Error ? error.message : String(error) })
    }
  }
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

function htmlEscape(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatBrDateTime(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return 'Nao informado'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: env('ZEEV_BUSINESS_TIMEZONE', 'America/Sao_Paulo'),
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date)
  } catch (_) {
    return date.toISOString()
  }
}

function formatBrMoney(value: unknown) {
  const n = Number(value || 0)
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(n) ? n : 0)
  } catch (_) {
    return `R$ ${(Number.isFinite(n) ? n : 0).toFixed(2)}`
  }
}

function notifyRecipients(value = env('ZEEV_NOTIFY_EMAIL', 'eduardo.falcao@raizeducacao.com.br')) {
  return String(value || '')
    .split(/[;,]+/)
    .map((email) => email.trim())
    .filter(Boolean)
}

async function sendHtmlEmail(subject: string, html: string, toValue?: string) {
  const recipients = notifyRecipients(toValue)
  if (!recipients.length) return { sent: false, reason: 'ZEEV_NOTIFY_EMAIL ausente' }
  const resend = env('RESEND_API_KEY')
  const from = env('ZEEV_EMAIL_FROM', 'Raiz ObraViva <onboarding@resend.dev>')
  if (resend) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resend}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: recipients.length === 1 ? recipients[0] : recipients, subject, html }),
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
        to: recipients.map((email) => ({ email })),
        subject,
        htmlContent: html,
      }),
    })
    if (!res.ok) return { sent: false, reason: `Brevo: ${await res.text()}` }
    return { sent: true, provider: 'brevo' }
  }

  return { sent: false, reason: 'RESEND_API_KEY ou BREVO_API_KEY ausente' }
}

async function sendEmail(ticket: AnyRecord) {
  const subject = `Novo Ticket Raiz CAPEX #${ticket.zeev_instance_id}`
  const link = String(ticket.ticket_link || '')
  const html = `
    <div style="font-family:Arial,sans-serif;color:#173C34;line-height:1.5">
      <h2 style="margin:0 0 12px">Novo Ticket Raiz marcado como CAPEX</h2>
      <p><b>Ticket:</b> ${htmlEscape(ticket.zeev_instance_id)}</p>
      <p><b>Fluxo:</b> ${htmlEscape(ticket.flow_name || ticket.request_name || '')}</p>
      <p><b>Solicitante:</b> ${htmlEscape(ticket.requester_name || '')}</p>
      <p><b>Etapa atual:</b> ${htmlEscape(ticket.etapa_atual || 'Nao informada')}</p>
      ${link ? `<p><a href="${htmlEscape(link)}">Abrir Ticket Raiz</a></p>` : ''}
      <p>O ticket ja esta aguardando analise na fila de CAPEX da Raiz ObraViva.</p>
    </div>`
  return await sendHtmlEmail(subject, html)
}

async function notifyNewTickets(tickets: AnyRecord[], existing: Map<number, AnyRecord>) {
  const notified: number[] = []
  const failed: AnyRecord[] = []
  for (const ticket of tickets) {
    const old = existing.get(Number(ticket.zeev_instance_id))
    if (old?.email_notified_at) continue
    if (old) continue
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

function syncStateMessage(errors: string[]) {
  const parts = errors.map((e) => String(e || '').trim()).filter(Boolean)
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
  const overlapHours = Number(input.overlapHours || env('ZEEV_SYNC_OVERLAP_HOURS', '72')) || 72
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
  const maxPages = Number(input.maxPages || env('ZEEV_MAX_PAGES', '16')) || 16
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
      last_error: syncStateMessage(errors),
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
      linkedPayments: reconcile.paymentLinked,
      notified: email.notified.length,
      emailFailures: email.failed,
      emailWarning: emailWarningText(email, shouldNotify),
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

async function runWebhookTicketSync(input: AnyRecord) {
  const requested = ticketIdsFromEventInput(input)
  const limit = Math.max(1, Math.min(Number(input.limit || input.maxTickets || input.max_tickets || 6), 12))
  const ids = requested.slice(0, limit)
  if (!ids.length) throw new Error('Webhook recebido sem numero de TR/instanceId.')
  const updatedTickets: AnyRecord[] = []
  const ignored: AnyRecord[] = []
  const errors: AnyRecord[] = []
  for (const id of ids) {
    try {
      const ticket = await loadWebhookTicketFromZeev({ ...(input || {}), zeev_instance_id: id, id })
      if (ticket?.capex_field_name || ticket?.capex_field_value) updatedTickets.push(ticket)
      else ignored.push({ tr: id, reason: 'CAPEX nao identificado como Sim no Zeev' })
    } catch (error) {
      errors.push({ tr: id, error: error instanceof Error ? error.message : String(error) })
    }
  }
  const unique = new Map<number, AnyRecord>()
  for (const ticket of updatedTickets) unique.set(Number(ticket.zeev_instance_id), ticket)
  const tickets = [...unique.values()]
  const existing = tickets.length ? await getExisting(tickets.map((ticket) => Number(ticket.zeev_instance_id))) : new Map<number, AnyRecord>()
  const saved = tickets.length ? await upsertTickets(tickets) : []
  const newCount = tickets.filter((ticket) => !existing.has(Number(ticket.zeev_instance_id))).length
  const reconcile = tickets.length ? await reconcileRegisteredTicketsTargeted(tickets) : { capexLinked: 0, paymentMatched: 0, paymentLinked: 0 }
  const email = tickets.length ? await notifyNewTickets(tickets, existing) : { notified: [], failed: [] }
  return {
    ok: errors.length === 0,
    mode: 'webhook-ticket',
    requested,
    processed: ids.length,
    saved: saved.length,
    new: newCount,
    updated: Math.max(0, saved.length - newCount),
    ignored,
    errors,
    linkedRegistered: reconcile.capexLinked,
    matchedPayments: reconcile.paymentMatched,
    linkedPayments: reconcile.paymentLinked,
    notified: email.notified.length,
    emailFailures: email.failed,
  }
}

async function runIngest(input: AnyRecord) {
  const tickets = Array.isArray(input.tickets) ? input.tickets : []
  const finalIngest = input.final !== false && input.partial !== true
  const ingestBackfillLimit = Math.max(0, Math.min(Number(input.backfillLimit || env('ZEEV_INGEST_BACKFILL_LIMIT', '2')), 8))
  if (!tickets.length) {
    const backfill = finalIngest && ingestBackfillLimit ? await runBackfillDocs({ limit: ingestBackfillLimit, fileLimit: 2, refresh: false, includePayments: true, includeCapex: true }) : null
    await saveState('zeev-capex', {
      running: !finalIngest,
      last_success_at: finalIngest ? new Date().toISOString() : undefined,
      last_error: null,
      last_run_found: 0,
      last_run_new: 0,
      last_run_updated: 0,
    })
    return { ok: true, mode: 'ingest', found: 0, new: 0, updated: 0, backfill, notified: 0 }
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
  const directDocTicketIds = normalized
    .filter((ticket: AnyRecord) => hasEmbeddedDownloadedDocs(ticket))
    .map((ticket: AnyRecord) => Number(ticket.zeev_instance_id))
    .filter(Boolean)
  const docCheckTicketIds = normalized
    .map((ticket: AnyRecord) => Number(ticket.zeev_instance_id))
    .filter(Boolean)
  const newCount = normalized.filter((t: AnyRecord) => !existing.has(Number(t.zeev_instance_id))).length
  const email = input.notify === true ? await notifyNewTickets(normalized, existing) : { notified: [], failed: [] }
  const directDocBackfill = finalIngest && docCheckTicketIds.length
    ? await runBackfillDocs({
      ticketIds: docCheckTicketIds.join(','),
      limit: Math.min(Math.max(docCheckTicketIds.length, ingestBackfillLimit || 1), 80),
      fileLimit: Math.max(1, Math.min(Number(input.directDocFileLimit || input.fileLimit || env('ZEEV_BACKFILL_FILE_LIMIT', '12')), 40)),
      fanoutTargets: input.fanoutTargets === true || input.fanout_targets === true,
      refresh: false,
      includePending: true,
      includePayments: true,
      includeCapex: true,
    })
    : null
  const scheduledBackfill = finalIngest && ingestBackfillLimit ? await runBackfillDocs({ limit: ingestBackfillLimit, fileLimit: 2, refresh: false, includePayments: true, includeCapex: true }) : null
  const backfill = directDocBackfill && scheduledBackfill
    ? { directDocs: directDocBackfill, scheduled: scheduledBackfill }
    : directDocBackfill || scheduledBackfill
  const directDocCleanup = directDocTicketIds.length ? await clearEmbeddedDownloadedDocs(directDocTicketIds) : null
  await saveState('zeev-capex', {
    running: !finalIngest,
    last_success_at: finalIngest ? new Date().toISOString() : undefined,
    last_error: null,
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
    linkedPayments: reconcile.paymentLinked,
    backfill,
    directDocCleanup,
    notified: email.notified.length,
    emailFailures: email.failed,
    emailWarning: emailWarningText(email, input.notify === true),
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
  const syncMode = String(input.workflowMode || input.syncMode || 'incremental')
  const flowIds = String(input.flowIds || input.flow_ids || env('ZEEV_FLOW_IDS') || DEFAULT_FLOW_IDS.join(','))
  const normalizedSyncMode = normKey(syncMode)
  const defaultMaxPages = syncMode === 'retro' || syncMode === 'deep-retro'
    ? '999'
    : normalizedSyncMode === 'incremental'
      ? '2'
      : '8'
  const requestedMaxPages = positiveNumber(input.maxPages || input.max_pages || defaultMaxPages, Number(defaultMaxPages))
  const lockTtlMinutes = positiveNumber(input.lockTtlMinutes || input.lock_ttl_minutes || env('ZEEV_GITHUB_LOCK_TTL_MINUTES') || (requestedMaxPages > 2 ? '75' : '25'), requestedMaxPages > 2 ? 75 : 25)
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
    const normalizedMode = normalizedSyncMode
    const workflowMode = normalizedMode === 'incremental'
      ? 'incremental'
      : syncMode === 'retro'
        ? 'retro'
        : (syncMode === 'deep-retro' ? 'deep-retro' : 'deep-incremental')
    const workflowInputs: Record<string, string> = {
      mode: workflowMode,
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
  const token = zeevToken()
  const extraTokens = zeevExtraTokensString()
  const secret = env('ZEEV_SYNC_SECRET')
  if (!token) throw new Error('ZEEV_TOKEN ausente nos secrets da Supabase.')
  if (!secret) throw new Error('ZEEV_SYNC_SECRET ausente nos secrets da Supabase.')
  const url = env('ZEEV_BRIDGE_URL', 'https://raiz-obras.vercel.app/api/zeev_capex_sync')
  const syncMode = String(input.workflowMode || input.syncMode || input.mode || 'incremental')
  const normalizedMode = normKey(syncMode)
  const defaultMaxPages = syncMode === 'retro' || syncMode === 'deep-retro'
    ? '999'
    : normalizedMode === 'incremental'
      ? '2'
      : '8'
  const body = {
    mode: normalizedMode === 'incremental'
      ? 'incremental'
      : syncMode === 'retro'
        ? 'retro'
        : (syncMode === 'deep-retro' ? 'deep-retro' : 'deep-incremental'),
    start: input.start || '',
    end: input.end || '',
    flowIds: input.flowIds || input.flow_ids || env('ZEEV_FLOW_IDS') || DEFAULT_FLOW_IDS.join(','),
    maxPages: input.maxPages || input.max_pages || defaultMaxPages,
    recordsPerPage: input.recordsPerPage || input.records_per_page || env('ZEEV_RECORDS_PER_PAGE', '30'),
    ticketIds: input.ticketIds || input.ticket_ids || input.instanceIds || input.instance_ids || '',
    extraTicketIds: input.extraTicketIds || input.extra_ticket_ids || '',
    businessTimezone: input.businessTimezone || input.business_timezone || env('ZEEV_BUSINESS_TIMEZONE', 'America/Sao_Paulo'),
    notify: input.notify !== false,
  }
  if (extraTokens) {
    ;(body as AnyRecord).zeevExtraTokens = extraTokens
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
      ...(extraTokens ? { 'x-zeev-extra-tokens': extraTokens } : {}),
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

function isBlockedFileHost(host: string) {
  const h = host.toLowerCase()
  if (!h || h === 'localhost' || h === '0.0.0.0' || h === '::1') return true
  if (h.startsWith('127.') || h.startsWith('10.') || h.startsWith('192.168.')) return true
  if (h === '169.254.169.254' || h.startsWith('169.254.')) return true
  const private172 = h.match(/^172\.(\d{1,3})\./)
  if (private172) {
    const n = Number(private172[1])
    if (n >= 16 && n <= 31) return true
  }
  return false
}

function safeZeevFileUrl(value: unknown) {
  try {
    const raw = String(value || '').trim()
    if (!raw) return null
    const base = env('ZEEV_BASE_URL', 'https://raizeducacao.zeev.it').replace(/\/$/, '')
    const url = new URL(raw, base)
    const host = url.hostname.toLowerCase()
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (isBlockedFileHost(host)) return null
    if (url.protocol === 'http:' && !(host === 'raizeducacao.zeev.it' || host.endsWith('.zeev.it') || host.includes('zeev'))) return null
    return url.toString()
  } catch (_) {
    return null
  }
}

function looksLikeFileUrl(value: unknown) {
  try {
    const raw = String(value || '').trim()
    if (!raw) return false
    const base = env('ZEEV_BASE_URL', 'https://raizeducacao.zeev.it').replace(/\/$/, '')
    const url = new URL(raw, base)
    const path = decodeURIComponent(url.pathname || '')
    const full = url.toString()
    if (isGoogleDriveUrl(full)) return true
    if (/\/Storage\//i.test(path)) return true
    if (/\/api\/2\/files(?:\/|$)/i.test(path)) return true
    if (/\.(pdf|xml|png|jpe?g|webp|tiff?|xlsx?|docx?|zip)$/i.test(path)) return true
    if (/(?:download|attachment|arquivo|anexo|file|documento)/i.test(path) && /(id|file|arquivo|anexo|attachment|document|doc|download)=/i.test(url.search)) return true
    return false
  } catch (_) {
    return false
  }
}

function shouldAcceptZeevDocUrl(url: string, label = '', source = '') {
  if (isZeevNavigationUrl(url, label, source)) return false
  if (looksLikeFileUrl(url)) return true
  const sourceKey = normKey(source)
  if (/(githubdirect|downloadeddocs|zeevdownloadeddocs|directdownloadeddocs)/.test(sourceKey)) return true
  return false
}

function looksLikeDownloadPath(value: unknown) {
  const s = String(value || '').trim()
  if (!s) return false
  if (/^https?:\/\//i.test(s)) return looksLikeFileUrl(s)
  if (/^(?:\.\.\/|\.\/|\/)?Storage\//i.test(s)) return true
  if (/\/Storage\/[^?#]+/i.test(s)) return true
  if (/\/api\/2\/files\//i.test(s)) return true
  if (/^[^\s<>"]+\.(pdf|xml|png|jpe?g|webp|tiff?|xlsx?|docx?|zip)(?:$|[?#])/i.test(s)) return true
  return false
}

function fileNameFromDownloadPath(value: unknown, fallback = 'documento-fiscal.pdf') {
  const clean = String(value || '').split(/[?#]/)[0].replace(/\\/g, '/')
  const name = clean.split('/').filter(Boolean).pop() || ''
  return name || fallback
}

function googleDriveFileId(value: unknown) {
  try {
    const url = new URL(String(value || '').trim())
    const host = url.hostname.toLowerCase()
    if (!host.includes('drive.google.com') && !host.includes('docs.google.com')) return ''
    const byQuery = url.searchParams.get('id')
    if (byQuery) return byQuery
    const match = url.pathname.match(/\/(?:file\/d|document\/d|spreadsheets\/d|presentation\/d)\/([^/]+)/i)
    return match?.[1] || ''
  } catch (_) {
    return ''
  }
}

function isGoogleDriveUrl(value: unknown) {
  return Boolean(googleDriveFileId(value))
}

function googleDriveDownloadUrls(value: unknown) {
  const id = googleDriveFileId(value)
  if (!id) return []
  const safeId = encodeURIComponent(id)
  return [
    `https://drive.google.com/uc?export=download&id=${safeId}`,
    `https://drive.usercontent.google.com/download?id=${safeId}&export=download`,
  ]
}

function fileNameFromResponse(url: string, headers: Headers) {
  const disp = headers.get('content-disposition') || ''
  const match = disp.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i)
  const fromHeader = match ? decodeURIComponent(match[1] || match[2] || '') : ''
  const fromUrl = url.split('/').pop()?.split('?')[0] || ''
  return (fromHeader || decodeURIComponent(fromUrl) || 'documento-fiscal.pdf').replace(/[^A-Za-z0-9._ -]+/g, '_')
}

function dateOnly(value: unknown) {
  const s = String(value || '').trim()
  if (!s) return ''
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const br = s.match(/(?:^|[^\d])(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})(?!\d)/)
  if (br) {
    const y = br[3].length === 2 ? `20${br[3]}` : br[3]
    return `${y.padStart(4, '0')}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function fiscalDocKind(doc: AnyRecord) {
  const raw = [doc.name, doc.source, doc.type, doc.kind, doc.url, doc.storagePath].filter(Boolean).join(' ')
  const hay = norm(raw)
  if (hay.includes('comprovante') || hay.includes('recibo') || hay.includes('pix')) return 'COMPROVANTE'
  if (hay.includes('boleto')) return 'BOLETO'
  if (hay.includes('fatura')) return 'FATURA'
  if (/\d{44}/.test(raw)) return 'NF'
  if (hay.includes('xml') || hay.includes('danfe') || hay.includes('nota') || hay.includes('nf')) return 'NF'
  return 'DOCUMENTO'
}

function isAlwaysIgnoredZeevDocCandidate(doc: AnyRecord) {
  const key = normKey([doc?.name, doc?.source].filter(Boolean).join(' '))
  if (!key) return false
  if (key.includes('codigodebarras')) return true
  if (key.includes('codigodocentrodecusto')) return true
  if (key.includes('rawinstanceformfieldsvalue')) return true
  return false
}

function isIgnorableHtmlDownloadError(doc: AnyRecord, error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  if (!/html em vez de arquivo/i.test(message)) return false
  const key = normKey([doc?.name, doc?.source].filter(Boolean).join(' '))
  if (key.includes('rawinstancedeep') && (key.includes('anexarboleto') || key.includes('boletoparcelado') || key.includes('boletoavista'))) return true
  if (key.includes('rawinstancedeep') && key.includes('comprovantedopagamento')) return true
  if (key.includes('rawinstanceformfieldsvalue')) return true
  if (key.includes('codigodebarras')) return true
  if (key.includes('codigodocentrodecusto')) return true
  return false
}

function isInvoiceDocKind(kind: unknown) {
  return String(kind || '').toUpperCase() === 'NF'
}

function isChargeDocKind(kind: unknown) {
  return ['BOLETO', 'FATURA'].includes(String(kind || '').toUpperCase())
}

function isProofDocKind(kind: unknown) {
  return String(kind || '').toUpperCase() === 'COMPROVANTE'
}

function isZeevAuditDoc(doc: AnyRecord | null | undefined) {
  const kind = String(doc?.kind || '').toUpperCase()
  return Boolean(doc?.system === true || doc?.__system === true || kind === 'ZEEV_AUDIT' || kind === 'AUDITORIA_ZEEV')
}

function latestZeevDocAudit(row: AnyRecord) {
  const docs = Array.isArray(row?.docs_json) ? row.docs_json : []
  for (let i = docs.length - 1; i >= 0; i--) {
    const doc = docs[i]
    if (doc && typeof doc === 'object' && isZeevAuditDoc(doc)) return doc
  }
  return null
}

function auditStatusNeedsAttention(status: unknown) {
  return ['parcial_limite', 'bloqueado_download', 'pendente_download', 'erro_download', 'candidatos_sem_anexo'].includes(String(status || '').toLowerCase())
}

function zeevDocAuditRetryAt(audit: AnyRecord | null | undefined) {
  const ts = Date.parse(String(audit?.retryAfter || audit?.retry_after || ''))
  return Number.isFinite(ts) ? ts : 0
}

function withLatestZeevDocAudit(docs: AnyRecord[], audit: AnyRecord) {
  const visible = (Array.isArray(docs) ? docs : []).filter((doc) => !isZeevAuditDoc(doc))
  return [...visible, audit]
}

function countStoredDocsByKind(docs: AnyRecord[]) {
  const out = { total: 0, fiscal: 0, charge: 0, proof: 0, other: 0 }
  for (const doc of docs || []) {
    if (isZeevAuditDoc(doc)) continue
    if (!Boolean(doc?.storagePath || doc?.path || doc?.url)) continue
    out.total++
    const kind = fiscalDocKind(doc)
    if (isInvoiceDocKind(kind)) out.fiscal++
    else if (isChargeDocKind(kind)) out.charge++
    else if (isProofDocKind(kind)) out.proof++
    else out.other++
  }
  return out
}

function buildZeevDocAudit(target: string, row: AnyRecord, ticket: AnyRecord, docs: AnyRecord[], attach: AnyRecord) {
  const now = new Date()
  const candidateCount = Number(attach?.effectiveCandidateCount ?? attach?.candidateCount ?? 0)
  const rawCandidateCount = Number(attach?.rawCandidateCount ?? attach?.candidateCount ?? candidateCount)
  const skipped = Array.isArray(attach?.skipped) ? attach.skipped : []
  const deduped = Array.isArray(attach?.deduped) ? attach.deduped : []
  const ignored = Array.isArray(attach?.ignored) ? attach.ignored : []
  const unattempted = Number(attach?.unattemptedCandidateCount || 0)
  const storedCounts = countStoredDocsByKind(docs)
  const attached = Number(attach?.attached || 0)
  const hasAnyCandidate = candidateCount > 0
  const hasInvoiceCandidate = Boolean(attach?.hasInvoiceCandidate)
  const hasChargeCandidate = Boolean(attach?.hasChargeCandidate)
  const hasProofCandidate = Boolean(attach?.hasProofCandidate)
  const requiredKindsCovered = storedCounts.total > 0
    && (!hasInvoiceCandidate || storedCounts.fiscal > 0)
    && (!hasChargeCandidate || storedCounts.charge > 0)
    && (!hasProofCandidate || storedCounts.proof > 0)
  const retryMinutes = Math.max(5, Math.min(Number(env('ZEEV_DOC_RETRY_MINUTES', '360')) || 360, 1440))
  let status = 'sem_documento_no_zeev'
  if (hasAnyCandidate && requiredKindsCovered && attached > 0) status = skipped.length ? 'concluido_com_alerta' : 'concluido'
  else if (hasAnyCandidate && requiredKindsCovered && attached <= 0) status = skipped.length ? 'ja_anexado_com_alerta' : 'ja_anexado'
  else if (hasAnyCandidate && unattempted > 0) status = 'parcial_limite'
  else if (hasAnyCandidate && skipped.length) status = 'bloqueado_download'
  else if (hasAnyCandidate && attached > 0) status = 'concluido'
  else if (hasAnyCandidate && storedCounts.total > 0) status = 'ja_anexado'
  else if (hasAnyCandidate) status = 'candidatos_sem_anexo'
  return {
    system: true,
    kind: 'ZEEV_AUDIT',
    origin: 'ZEEV',
    target,
    rowId: row?.id || null,
    ticketRaiz: ticketDigits(ticket?.zeev_instance_id || row?.ticket_raiz || row?.ticket_raiz_instance_id || row?.referencia || ''),
    checkedAt: now.toISOString(),
    status,
    retryAfter: auditStatusNeedsAttention(status) ? new Date(now.getTime() + retryMinutes * 60 * 1000).toISOString() : '',
    candidateCount,
    rawCandidateCount,
    attemptedCandidateCount: Number(attach?.attemptedCandidateCount || 0),
    unattemptedCandidateCount: unattempted,
    attachedCount: attached,
    storedDocCount: storedCounts.total,
    storedFiscalCount: storedCounts.fiscal,
    storedChargeCount: storedCounts.charge,
    storedProofCount: storedCounts.proof,
    hasInvoiceCandidate,
    hasChargeCandidate,
    hasProofCandidate,
    requiredKindsCovered,
    skippedCount: skipped.length,
    dedupedCount: deduped.length,
    ignoredCount: ignored.length,
    skipped: skipped.slice(0, 8),
    deduped: deduped.slice(0, 8),
    ignored: ignored.slice(0, 8),
  }
}

function financialDocPriority(doc: AnyRecord) {
  const kind = fiscalDocKind(doc)
  if (isInvoiceDocKind(kind)) return 0
  if (isChargeDocKind(kind)) return 1
  if (isProofDocKind(kind)) return 2
  if (String(kind).toUpperCase() === 'DOCUMENTO') return 3
  return 4
}

function pushZeevDoc(out: AnyRecord[], name: unknown, url: unknown, type = '', source = '') {
  const cleanUrl = safeZeevFileUrl(url)
  const cleanName = String(name || 'documento-fiscal.pdf').trim()
  if (!cleanUrl) return
  if (!shouldAcceptZeevDocUrl(cleanUrl, cleanName, source)) return
  const key = `${cleanUrl}|${source || cleanName}`
  if (out.some((d) => d.key === key)) return
  out.push({ key, name: cleanName || 'documento-fiscal.pdf', url: cleanUrl, type: String(type || ''), source: String(source || '') })
}

function isZeevNavigationUrl(url: string, label = '', source = '') {
  const rawUrl = String(url || '')
  const labelKey = normKey(`${label} ${source}`)
  if (/(reportlink|ticketlink|linkdoticket|linkdasolicitacao|visualizarticket|auditlink)/.test(labelKey)) return true
  if (/\/2\.0\/audit(?:\?|$)/i.test(rawUrl)) return true
  if (/\/api\/2\/instances\/\d+(?:$|[?#])/i.test(rawUrl)) return true
  return false
}

function pushZeevFileIdDoc(out: AnyRecord[], name: unknown, fileId: unknown, type = '', source = '') {
  const id = String(fileId || '').trim()
  if (!id || id.length > 180) return
  const cleanName = String(name || 'documento-fiscal.pdf').trim() || 'documento-fiscal.pdf'
  const key = `fileId:${source || cleanName}:${id}`
  if (out.some((d) => d.key === key)) return
  out.push({ key, name: cleanName, fileId: id, type: String(type || ''), source: String(source || '') })
}

function pushZeevBase64Doc(out: AnyRecord[], name: unknown, base64Content: unknown, type = '', source = '') {
  const raw = String(base64Content || '').trim()
  if (!raw || raw.length < 80) return
  const cleanName = String(name || 'documento-fiscal.pdf').trim() || 'documento-fiscal.pdf'
  const key = `base64:${source || cleanName}:${raw.slice(0, 48)}:${raw.length}`
  if (out.some((d) => d.key === key)) return
  out.push({ key, name: cleanName, base64Content: raw, type: String(type || ''), source: String(source || '') })
}

function objectFileHints(value: AnyRecord) {
  if (!value || typeof value !== 'object') return false
  return Object.keys(value).some((k) => /(url|link|file|arquivo|anexo|base64|document|doc|attachment|filename|originalname|download|mimetype|contenttype|contenturl)/i.test(k))
}

function looksLikeZeevDocumentLabel(value: unknown) {
  const n = normKey(value)
  if (!n) return false
  if (n === 'nf' || n.startsWith('nfe') || n.startsWith('nfse') || n.startsWith('nfs')) return true
  return /(notafiscal|notafiscal|notasfiscais|nota|danfe|xml|pdf|arquivo|anexo|boleto|comprovante|documento|document|doc|fatura|recibo|file|attachment|download)/.test(n)
}

function pushZeevDocValue(out: AnyRecord[], label: string, value: unknown, source: string) {
  if (value == null) return
  if (Array.isArray(value)) {
    for (const item of value) pushZeevDocValue(out, label, item, source)
    return
  }
  if (typeof value === 'object') {
    const v = value as AnyRecord
    const valuePath = looksLikeDownloadPath(v.value) ? v.value : ''
    const url = v.url || v.openUrl || v.downloadUrl || v.href || v.link || v.fileUrl || v.signedUrl || v.contentUrl || valuePath || ''
    const name = v.fileName || v.filename || v.originalName || v.displayName || v.title || v.label || (valuePath ? fileNameFromDownloadPath(valuePath, label) : '') || v.name || label || 'documento-fiscal.pdf'
    pushZeevDoc(out, name, url, v.type || v.mimeType || v.contentType || '', source)
    const explicitFileId = v.fileId || v.fileID || v.file_id || v.arquivoId || v.arquivoID || v.documentId || v.documentID || v.document_id || v.attachmentId || v.attachmentID || v.attachment_id || ''
    const inferredFileId = !explicitFileId && objectFileHints(v) && looksLikeZeevDocumentLabel([source, label, name].filter(Boolean).join(' ')) ? v.id : ''
    const fileId = explicitFileId || inferredFileId
    if (fileId) pushZeevFileIdDoc(out, name, fileId, v.type || v.mimeType || v.contentType || '', source)
    const base64Content = v.base64Content || v.base64 || v.contentBase64 || v.fileBase64 || v.bytesBase64 || ''
    if (base64Content) pushZeevBase64Doc(out, name, base64Content, v.type || v.mimeType || v.contentType || '', source)
    for (const [k, nested] of Object.entries(v)) {
      const nk = normKey(k)
      if (/url|link|file|arquivo|anexo|documento|document|attachment|base64|content|nota|fatura|boleto|recibo|pdf|xml|comprovante/.test(nk)) {
        pushZeevDocValue(out, String(name || k), nested, source)
      }
    }
    return
  }
  const s = String(value || '').trim()
  if (looksLikeDownloadPath(s)) pushZeevDoc(out, fileNameFromDownloadPath(s, label || 'documento-fiscal.pdf'), s, '', source)
}

function pushZeevDocText(out: AnyRecord[], label: string, value: unknown, source: string) {
  const text = String(value || '')
  if (!text) return
  const proofLabel = /(comprovante|recibo|pix|pagamento|pago|liquidado)/.test(norm(text)) ? 'comprovante pagamento' : label
  const urls = text.match(/https?:\/\/[^\s"'<>]+/gi) || []
  for (const url of urls) {
    const cleanUrl = url.replace(/[),.;]+$/, '')
    if (isZeevNavigationUrl(cleanUrl, label, source)) continue
    const driveProof = source === 'messages' && isGoogleDriveUrl(cleanUrl)
    pushZeevDoc(out, driveProof ? 'comprovante pagamento' : proofLabel || 'documento-fiscal.pdf', cleanUrl, '', source)
  }
}

function collectZeevDocsDeep(out: AnyRecord[], label: string, value: unknown, source: string, depth = 0, contextLooksDoc = false, seen = new WeakSet<object>()) {
  if (value == null || depth > 8) return
  const labelText = String(label || '').trim()
  const labelLooksDoc = looksLikeZeevDocumentLabel(labelText)
  if (typeof value === 'string') {
    if (/https?:\/\//i.test(value)) pushZeevDocText(out, labelText || 'documento Zeev', value, source)
    if (contextLooksDoc || labelLooksDoc) pushZeevDocValue(out, labelText || 'documento Zeev', value, source)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectZeevDocsDeep(out, labelText, item, source, depth + 1, contextLooksDoc || labelLooksDoc, seen)
    return
  }
  if (typeof value !== 'object') return
  const obj = value as AnyRecord
  if (seen.has(obj)) return
  seen.add(obj)
  const keys = Object.keys(obj)
  const hasDocKey = keys.some((key) => looksLikeZeevDocumentLabel(key))
  const textCarrier = /(comments?|comentarios?|mensagens?|message|body|texto|description|descricao|observacao|resultado|result|historico|history|task|tarefa)/.test(normKey(labelText))
  const activeContext = contextLooksDoc || labelLooksDoc || hasDocKey || objectFileHints(obj)
  if (activeContext) pushZeevDocValue(out, labelText || source || 'documento Zeev', obj, source)
  for (const [key, child] of Object.entries(obj)) {
    const childLabel = labelText ? `${labelText} ${key}` : key
    const childLooksDoc = activeContext || looksLikeZeevDocumentLabel(key) || textCarrier || /(comments?|comentarios?|mensagens?|message|body|texto|description|descricao|observacao|resultado|result|historico|history|task|tarefa)/.test(normKey(key))
    collectZeevDocsDeep(out, childLabel, child, source, depth + 1, childLooksDoc, seen)
  }
}

function embeddedDocArray(ticket: AnyRecord) {
  const raw = ticket?.raw_instance || ticket?.rawInstance || {}
  const candidates = [
    ticket?.__downloaded_docs,
    ticket?.downloaded_docs,
    ticket?.zeev_downloaded_docs,
    raw?.__downloaded_docs,
    raw?.downloadedDocs,
    raw?.zeevDownloadedDocs,
    raw?.directDownloadedDocs,
  ]
  for (const value of candidates) {
    if (Array.isArray(value) && value.length) return value
  }
  return []
}

function hasEmbeddedDownloadedDocs(ticket: AnyRecord) {
  return embeddedDocArray(ticket).some((doc: AnyRecord) => doc?.base64Content || doc?.url || doc?.fileId)
}

function stripEmbeddedDownloadedDocs(raw: AnyRecord) {
  if (!raw || typeof raw !== 'object') return raw
  const next = { ...raw }
  for (const key of ['__downloaded_docs', 'downloadedDocs', 'zeevDownloadedDocs', 'directDownloadedDocs']) {
    if (key in next) delete next[key]
  }
  return next
}

async function clearEmbeddedDownloadedDocs(ticketIds: number[]) {
  const ids = [...new Set(ticketIds.map((id) => Number(id)).filter(Boolean))]
  if (!ids.length) return { checked: 0, cleaned: 0 }
  const rows = await rest(`/capex_zeev_solicitacoes?select=id,zeev_instance_id,raw_instance&zeev_instance_id=in.(${ids.join(',')})&limit=${ids.length}`)
  let cleaned = 0
  for (const row of rows || []) {
    const raw = row?.raw_instance
    if (!raw || typeof raw !== 'object' || !hasEmbeddedDownloadedDocs({ raw_instance: raw })) continue
    await rest(`/capex_zeev_solicitacoes?id=eq.${Number(row.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ raw_instance: stripEmbeddedDownloadedDocs(raw) }),
    })
    cleaned++
  }
  return { checked: (rows || []).length, cleaned }
}

function zeevDocsFromTicket(ticket: AnyRecord) {
  const docs: AnyRecord[] = []
  for (const doc of embeddedDocArray(ticket)) {
    pushZeevDocValue(docs, doc?.name || 'documento-fiscal.pdf', doc, doc?.source || 'github-direct')
  }
  const rows = Array.isArray(ticket?.raw_fields) ? ticket.raw_fields : Array.isArray(ticket?.rawFields) ? ticket.rawFields : []
  for (const f of rows || []) {
    if (!f || typeof f !== 'object') continue
    const label = String(f.name || f.label || f.title || f.caption || '')
    const n = normKey(label)
    const looksDoc = looksLikeZeevDocumentLabel(n)
    const openUrl = f.openUrl || f.url || f.downloadUrl || ''
    if (!looksDoc && !openUrl && !objectFileHints(f)) continue
    const rawVal = f.value ?? f.displayValue ?? f.text ?? f.values ?? ''
    if (openUrl) pushZeevDoc(docs, String(rawVal || '').length < 180 ? rawVal : label, openUrl, f.type || '', label || 'raw_fields')
    pushZeevDocValue(docs, label || 'documento-fiscal', f, label || 'raw_fields')
    pushZeevDocValue(docs, label || 'documento-fiscal', rawVal, label || 'raw_fields')
  }
  const fields = ticket?.campos_extraidos || ticket?.campos || {}
  for (const [k, v] of Object.entries(fields || {})) {
    if (!looksLikeZeevDocumentLabel(k)) continue
    pushZeevDocValue(docs, k, v, k)
  }
  const tasks = Array.isArray(ticket?.raw_tasks) ? ticket.raw_tasks : Array.isArray(ticket?.rawTasks) ? ticket.rawTasks : []
  for (const task of tasks || []) {
    if (!task || typeof task !== 'object') continue
    const label = String(task?.task?.name || task?.alias || 'tarefa')
    if (objectFileHints(task)) pushZeevDocValue(docs, label, task, 'instanceTasks')
    pushZeevDocText(docs, label, [task?.comments, task?.comment, task?.description, task?.result].filter(Boolean).join(' '), 'instanceTasks')
  }
  const messages = Array.isArray(ticket?.raw_messages)
    ? ticket.raw_messages
    : Array.isArray(ticket?.rawMessages)
      ? ticket.rawMessages
      : Array.isArray(ticket?.raw_instance?.__messages)
        ? ticket.raw_instance.__messages
        : []
  for (const msg of messages || []) {
    if (!msg || typeof msg !== 'object') continue
    const label = String(msg?.title || msg?.subject || msg?.author?.name || msg?.createdBy?.name || 'comentario Zeev')
    pushZeevDocValue(docs, label, msg, 'messages')
    pushZeevDocText(docs, label, msg?.body || msg?.text || msg?.message || msg?.comment || '', 'messages')
  }
  const instance = ticket?.raw_instance || ticket?.rawInstance || {}
  if (instance && typeof instance === 'object') {
    for (const key of ['__downloaded_docs', 'downloadedDocs', 'zeevDownloadedDocs', 'directDownloadedDocs', 'files', 'attachments', 'documents', 'docs', 'instanceFiles', 'requestFiles', 'formFields', 'instanceTasks']) {
      if (Array.isArray(instance[key]) && objectFileHints({ [key]: instance[key] })) {
        pushZeevDocValue(docs, key, instance[key], `raw_instance.${key}`)
      }
    }
    collectZeevDocsDeep(docs, 'raw_instance', instance, 'raw_instance.deep')
  }
  return docs
}

function docFieldDebug(ticket: AnyRecord) {
  const rows = Array.isArray(ticket?.raw_fields) ? ticket.raw_fields : Array.isArray(ticket?.rawFields) ? ticket.rawFields : []
  return (rows || [])
    .map((f: AnyRecord) => {
      const label = String(f?.name || f?.label || f?.title || f?.caption || '')
      const n = normKey(label)
      const value = f?.value ?? f?.displayValue ?? f?.text ?? f?.values ?? ''
      const looksDoc = looksLikeZeevDocumentLabel(n)
      const keys = f && typeof f === 'object' ? Object.keys(f).filter((k) => /(url|link|file|arquivo|anexo|base64|content|name|id|value)/i.test(k)).slice(0, 12) : []
      const hasUrl = Boolean(f?.openUrl || f?.url || f?.downloadUrl || (typeof value === 'string' && /^https?:\/\//i.test(value)))
      if (!looksDoc && !hasUrl && !keys.some((k) => /(file|arquivo|anexo|base64)/i.test(k))) return null
      return {
        label: label || '(sem nome)',
        type: f?.type || f?.fieldType || '',
        row: f?.row || null,
        keys,
        hasUrl,
        valueType: Array.isArray(value) ? 'array' : typeof value,
        valueLength: typeof value === 'string' ? value.length : Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.keys(value).length : 0,
      }
    })
    .filter(Boolean)
    .slice(0, 40)
}

function taskDocDebug(ticket: AnyRecord) {
  const tasks = Array.isArray(ticket?.raw_tasks) ? ticket.raw_tasks : Array.isArray(ticket?.rawTasks) ? ticket.rawTasks : []
  return (tasks || []).map((task: AnyRecord) => {
    const keys = task && typeof task === 'object' ? Object.keys(task).filter((k) => /(file|arquivo|anexo|document|doc|attachment)/i.test(k)) : []
    return keys.length ? { taskId: task.id || null, taskName: task?.task?.name || task.alias || '', keys } : null
  }).filter(Boolean).slice(0, 20)
}

function addDocDebug(out: AnyRecord, target: string, row: AnyRecord, ticket: AnyRecord, attach: AnyRecord) {
  if (!Array.isArray(out.debugDocs)) out.debugDocs = []
  if (out.debugDocs.length >= 12) return
  const candidates = zeevDocsFromTicket(ticket)
  const candidatePreview = candidates.slice(0, 16).map((doc: AnyRecord) => {
    let path = ''
    let queryLength = 0
    try {
      const url = doc?.url ? new URL(String(doc.url)) : null
      path = url?.pathname || ''
      queryLength = (url?.search || '').length
    } catch (_) {
      path = ''
    }
    return {
      name: doc?.name || '',
      source: doc?.source || '',
      kind: fiscalDocKind(doc),
      hasUrl: Boolean(doc?.url),
      path,
      queryLength,
      hasFileId: Boolean(doc?.fileId),
    }
  })
  out.debugDocs.push({
    target,
    rowId: row?.id || null,
    tr: ticketDigits(ticket?.zeev_instance_id || row?.ticket_raiz || row?.ticket_raiz_instance_id || row?.referencia || ''),
    flowId: ticket?.flow_id || ticket?.flowId || ticket?.raw_instance?.flow?.id || null,
    flowName: ticket?.flow_name || ticket?.flowName || ticket?.raw_instance?.flow?.name || '',
    rawFieldCount: Array.isArray(ticket?.raw_fields) ? ticket.raw_fields.length : Array.isArray(ticket?.rawFields) ? ticket.rawFields.length : 0,
    rawTaskCount: Array.isArray(ticket?.raw_tasks) ? ticket.raw_tasks.length : Array.isArray(ticket?.rawTasks) ? ticket.rawTasks.length : 0,
    docCandidates: candidates.length,
    urlCandidates: candidates.filter((doc: AnyRecord) => doc.url).length,
    base64Candidates: candidates.filter((doc: AnyRecord) => doc.base64Content).length,
    attached: Number(attach?.attached || 0),
    skipped: Array.isArray(attach?.skipped) ? attach.skipped : [],
    candidatePreview,
    docFields: docFieldDebug(ticket),
    taskDocHints: taskDocDebug(ticket),
  })
}

function storedDocKey(doc: AnyRecord) {
  return String(doc?.storagePath || doc?.url || doc?.name || '').trim().toLowerCase()
}

function normalizeStoredDocs(row: AnyRecord) {
  const docs: AnyRecord[] = []
  const push = (doc: AnyRecord | null, kind = '') => {
    if (!doc) return
    if (isZeevAuditDoc(doc)) return
    if (isInvalidStoredDoc(doc)) return
    const item = { ...doc, kind: doc.kind || kind, bucket: doc.bucket || 'pagamentos' }
    const key = storedDocKey(item)
    if (!key || docs.some((d) => storedDocKey(d) === key)) return
    docs.push(item)
  }
  for (const doc of Array.isArray(row?.docs_json) ? row.docs_json : []) push(doc, doc?.kind || '')
  if (row?.nf_doc_path) push({ name: String(row.nf_doc_path).split('/').pop(), storagePath: row.nf_doc_path, type: '', kind: 'NF', bucket: 'pagamentos' }, 'NF')
  if (row?.comp_doc_path) push({ name: String(row.comp_doc_path).split('/').pop(), storagePath: row.comp_doc_path, type: '', kind: 'COMPROVANTE', bucket: 'pagamentos' }, 'COMPROVANTE')
  return docs
}

function isInvalidStoredDoc(doc: AnyRecord) {
  const type = String(doc?.type || doc?.contentType || '').toLowerCase()
  const name = String(doc?.name || doc?.storagePath || doc?.path || '').toLowerCase()
  if (type.includes('text/html') || type.includes('application/xhtml')) return true
  if (name.endsWith('.html') || name.endsWith('.htm')) return true
  return false
}

function encodeStoragePath(path: string) {
  return path.split('/').map((part) => encodeURIComponent(part)).join('/')
}

function safeStorageName(name: unknown) {
  return String(name || 'documento-fiscal.pdf').replace(/[^A-Za-z0-9._ -]+/g, '_').slice(0, 140) || 'documento-fiscal.pdf'
}

function extensionFromContentType(type: unknown) {
  const t = String(type || '').toLowerCase()
  if (t.includes('pdf')) return '.pdf'
  if (t.includes('xml')) return '.xml'
  if (t.includes('png')) return '.png'
  if (t.includes('jpeg') || t.includes('jpg')) return '.jpg'
  if (t.includes('webp')) return '.webp'
  if (t.includes('tiff') || t.includes('tif')) return '.tif'
  if (t.includes('json')) return '.json'
  if (t.includes('plain')) return '.txt'
  return ''
}

function ensureStorageExtension(name: unknown, type: unknown) {
  const clean = safeStorageName(name)
  if (/\.[A-Za-z0-9]{2,8}$/.test(clean)) return clean
  return `${clean}${extensionFromContentType(type) || '.pdf'}`
}

function decodeBase64Doc(doc: AnyRecord) {
  const raw = String(doc?.base64Content || '').trim()
  if (!raw) return null
  const match = raw.match(/^data:([^;]+);base64,(.+)$/i)
  const type = match?.[1] || doc?.type || 'application/octet-stream'
  const b64 = (match?.[2] || raw).replace(/\s+/g, '')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return {
    body: bytes.buffer,
    name: ensureStorageExtension(doc.name || 'documento-fiscal.pdf', type),
    type,
  }
}

function fileDownloadUrls(doc: AnyRecord) {
  const urls: string[] = []
  const push = (value: unknown) => {
    const url = safeZeevFileUrl(value)
    if (url && !urls.includes(url)) urls.push(url)
  }
  push(doc?.url)
  push(doc?.openUrl)
  push(doc?.downloadUrl)
  push(doc?.fileUrl)
  push(doc?.signedUrl)
  push(doc?.contentUrl)
  for (const value of [doc?.url, doc?.openUrl, doc?.downloadUrl, doc?.fileUrl, doc?.signedUrl, doc?.contentUrl]) {
    for (const driveUrl of googleDriveDownloadUrls(value)) push(driveUrl)
  }
  const fileId = String(doc?.fileId || '').trim()
  if (fileId) {
    const base = env('ZEEV_BASE_URL', 'https://raizeducacao.zeev.it').replace(/\/$/, '')
    const template = REQUEST_ZEEV_FILE_DOWNLOAD_URL_TEMPLATE || env('ZEEV_FILE_DOWNLOAD_URL_TEMPLATE')
    if (template) push(template.replace(/\{fileId\}/g, encodeURIComponent(fileId)).replace(/\{id\}/g, encodeURIComponent(fileId)))
    for (const path of [
      `/api/2/files/${encodeURIComponent(fileId)}`,
      `/api/2/files/${encodeURIComponent(fileId)}/download`,
      `/api/2/files/download/${encodeURIComponent(fileId)}`,
      `/api/2/files/instance-task/${encodeURIComponent(fileId)}`,
      `/api/2/files/instance-task/${encodeURIComponent(fileId)}/download`,
    ]) push(`${base}${path}`)
  }
  return urls
}

function docFromJsonPayload(payload: unknown, fallback: AnyRecord) {
  if (!payload || typeof payload !== 'object') return null
  const found: AnyRecord[] = []
  pushZeevDocValue(found, fallback.name || 'documento-fiscal.pdf', payload, fallback.source || 'download-json')
  return found.find((doc) => doc.base64Content || doc.url || doc.fileId) || null
}

async function downloadZeevDocFromUrl(doc: AnyRecord, url: string, depth = 0): Promise<{ body: ArrayBuffer; name: string; type: string } | null> {
  if (!zeevToken()) throw new Error('ZEEV_TOKEN ausente nos secrets da Supabase.')
  const res = await zeevBinaryRequest(url, {
    headers: {
      Accept: '*/*',
      'User-Agent': 'RaizObraViva/1.0 (+https://raiz-obras.vercel.app)',
    },
  }, {
    timeoutMs: Math.max(4000, Math.min(Number(env('ZEEV_FILE_DOWNLOAD_TIMEOUT_MS', '8000')) || 8000, 30000)),
    maxTokens: Math.max(1, Math.min(Number(env('ZEEV_FILE_TOKEN_ATTEMPT_LIMIT', '2')) || 2, 6)),
  })
  const type = res.headers.get('content-type') || doc.type || 'application/octet-stream'
  if (depth < 2 && /application\/json|text\/json/i.test(type)) {
    const text = await res.text()
    try {
      const nested = docFromJsonPayload(JSON.parse(text), doc)
      if (nested) return await downloadZeevDoc(nested, depth + 1)
    } catch (_) {
      // Some Zeev download endpoints return JSON metadata before a final signed URL.
    }
    const bytes = new TextEncoder().encode(text)
    return { body: bytes.buffer, name: ensureStorageExtension(doc.name || fileNameFromResponse(url, res.headers) || 'zeev-metadata.json', 'application/json'), type: 'application/json' }
  }
  if (/text\/html/i.test(type)) {
    const text = await res.text()
    const confirmMatch = depth < 2 ? text.match(/href="([^"]*(?:uc\?export=download|download\?id=)[^"]+)"/i) : null
    if (confirmMatch) {
      const nestedUrl = new URL(confirmMatch[1].replace(/&amp;/g, '&'), url).toString()
      return await downloadZeevDocFromUrl(doc, nestedUrl, depth + 1)
    }
    throw new Error('URL retornou HTML em vez de arquivo para download.')
  }
  const body = await res.arrayBuffer()
  return {
    body,
    name: ensureStorageExtension(doc.name || fileNameFromResponse(url, res.headers), type),
    type,
  }
}

async function downloadZeevDoc(doc: AnyRecord, depth = 0): Promise<{ body: ArrayBuffer; name: string; type: string } | null> {
  if (doc?.base64Content) return decodeBase64Doc(doc)
  const urls = fileDownloadUrls(doc)
  if (!urls.length) return null
  const errors: string[] = []
  const urlAttemptLimit = Math.max(1, Math.min(Number(env('ZEEV_FILE_URL_ATTEMPT_LIMIT', '4')) || 4, urls.length, 12))
  for (const url of urls.slice(0, urlAttemptLimit)) {
    try {
      const file = await downloadZeevDocFromUrl(doc, url, depth)
      if (file) return file
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  if (errors.length) throw new Error(errors.join(' | ').slice(0, 900))
  return null
}

async function uploadPaymentStorage(path: string, file: { body: ArrayBuffer; type: string }) {
  const base = env('SUPABASE_URL').replace(/\/$/, '')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  const res = await fetch(`${base}/storage/v1/object/pagamentos/${encodeStoragePath(path)}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: file.body,
  })
  const text = await res.text()
  if (!res.ok && res.status !== 409) throw new Error(`Storage upload ${res.status}: ${text}`)
  return path
}

async function sha256Hex(body: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', body)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function storedDocPath(doc: AnyRecord) {
  return String(doc?.storagePath || doc?.path || '').trim()
}

async function downloadPaymentStorage(path: string) {
  if (!path) return null
  const base = env('SUPABASE_URL').replace(/\/$/, '')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  const res = await fetch(`${base}/storage/v1/object/pagamentos/${encodeStoragePath(path)}`, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  })
  if (!res.ok) return null
  return await res.arrayBuffer()
}

function sameStoredDocScope(doc: AnyRecord, kind: string, ticketId: string) {
  const docKind = fiscalDocKind(doc)
  if (docKind !== kind) return false
  if (!ticketId) return true
  const path = storedDocPath(doc)
  const rawTicket = ticketDigits(doc?.ticketRaiz || doc?.ticket_raiz || doc?.ticket || '')
  return rawTicket === ticketId || path.includes(`zeev_tr_${ticketId}/`) || path.includes(`zeev_tr_${ticketId}\\`)
}

async function storedDocMatchesDownloadedFile(stored: AnyRecord[], kind: string, ticketId: string, file: { body: ArrayBuffer; name: string; type: string }, fileHash: string, hashCache: Map<string, string>) {
  for (const doc of stored) {
    if (!sameStoredDocScope(doc, kind, ticketId)) continue
    const storedHash = String(doc?.sha256 || doc?.hash || '').trim().toLowerCase()
    if (storedHash && storedHash === fileHash) return true
    const path = storedDocPath(doc)
    if (!path) continue
    let existingHash = hashCache.get(path)
    if (!existingHash) {
      const bytes = await downloadPaymentStorage(path)
      if (!bytes) continue
      existingHash = await sha256Hex(bytes)
      hashCache.set(path, existingHash)
      doc.sha256 = existingHash
      doc.size = doc.size || bytes.byteLength
    }
    if (existingHash === fileHash) return true
  }
  return false
}

function paymentDateFromTicket(ticket: AnyRecord) {
  const pagamento = ticket?.pagamento_json || ticket?.pagamento || {}
  const fromJson = dateOnly(pagamento.data_pagamento || pagamento.dataPagamento)
  if (fromJson) return fromJson
  const fmap = fieldMap(Array.isArray(ticket?.raw_fields) ? ticket.raw_fields : Array.isArray(ticket?.rawFields) ? ticket.rawFields : [])
  const fromField = dateOnly(firstField(fmap, ['dataPagamento', 'data do pagamento', 'pagoEm', 'pago em', 'dataEfetivaPagamento', 'data efetiva de pagamento', 'dataLiquidacao', 'data liquidacao', 'dataBaixa', 'data baixa']))
  if (fromField) return fromField
  const fromFinanceCompletion = paymentDateFromFinanceCompletion(ticket)
  if (fromFinanceCompletion) return fromFinanceCompletion
  const fromTask = paymentDateFromTasks(ticket)
  if (fromTask) return fromTask
  return paymentDateFromMessages(ticket)
}

function paymentLifecycleStatusFromTicket(ticket: AnyRecord) {
  const result = ticketResultKind(ticket)
  if (result === 'cancelado' || result === 'rejeitado') return 'Cancelado'
  return ''
}

function dueDateFromTicket(ticket: AnyRecord) {
  const pagamento = ticket?.pagamento_json || ticket?.pagamento || {}
  const fromJson = dateOnly(pagamento.previsao_pagamento || pagamento.previsaoPagamento || pagamento.dataVencimento || pagamento.data_vencimento)
  if (fromJson) return fromJson
  const fmap = fieldMap(Array.isArray(ticket?.raw_fields) ? ticket.raw_fields : Array.isArray(ticket?.rawFields) ? ticket.rawFields : [])
  return dateOnly(firstField(fmap, ['previsaoPagamento', 'previsao de pagamento', 'dataDeVencimento', 'data de vencimento', 'dataVencimento', 'vencimento']))
}

function dateFromAnyObject(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const obj = value as AnyRecord
  for (const key of ['endDateTime', 'finishedDateTime', 'finishDateTime', 'completedAt', 'completedDate', 'doneAt', 'doneDate', 'dateEnd', 'endedAt', 'lastFinishedTaskDateTime', 'createdAt', 'createdDateTime', 'createDateTime', 'dateTime', 'date']) {
    const d = dateOnly(obj[key])
    if (d) return d
  }
  return ''
}

function textHasPaymentDoneEvidence(value: unknown) {
  const n = norm(value)
  if (!n) return false
  if (/(cancelad|rejeitad|reprovad|estornad|nao pago|não pago)/.test(n)) return false
  const paymentCue = /(pagamento|pagar|pago|baixad|liquidad|comprovante|recibo|pix)/.test(n)
  const doneCue = /(realizad|efetuad|concluid|finalizad|baixad|liquidad|pago|aprovad|comprovante|recibo|pix)/.test(n)
  return paymentCue && doneCue
}

function paymentDateFromFinanceCompletion(ticket: AnyRecord) {
  if (!isFinanceiro(ticket)) return ''
  const result = ticketResultKind({
    flowResult: ticket?.flow_result || ticket?.flowResult || ticket?.raw_instance?.flowResult || ticket?.rawInstance?.flowResult || '',
  })
  if (result === 'cancelado' || result === 'rejeitado') return ''
  const raw = ticket?.raw_instance || ticket?.rawInstance || {}
  const active = ticket?.active ?? raw?.active
  const completed = active === false || Boolean(ticket?.end_date_time || raw?.endDateTime || ticket?.last_finished_task_date_time || raw?.lastFinishedTaskDateTime)
  if (!completed) return ''
  return dateOnly(ticket?.end_date_time || raw?.endDateTime || ticket?.last_finished_task_date_time || raw?.lastFinishedTaskDateTime)
}

function paymentDateFromTasks(ticket: AnyRecord) {
  const tasks = Array.isArray(ticket?.raw_tasks) ? ticket.raw_tasks : Array.isArray(ticket?.rawTasks) ? ticket.rawTasks : []
  for (const task of tasks || []) {
    const text = [task?.task?.name, task?.alias, task?.result, task?.status, task?.comments, task?.comment, task?.description].filter(Boolean).join(' ')
    if (!textHasPaymentDoneEvidence(text)) continue
    const d = dateFromAnyObject(task)
    if (d) return d
  }
  return ''
}

function dateNearPaymentText(value: unknown) {
  const text = String(value || '')
  if (!textHasPaymentDoneEvidence(text)) return ''
  const br = text.match(/(?:pago|pagamento|baixad[ao]|liquidad[ao]|comprovante|recibo|pix)[\s\S]{0,80}?(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i)
  if (br) return dateOnly(br[1])
  const isoMatch = text.match(/(?:pago|pagamento|baixad[ao]|liquidad[ao]|comprovante|recibo|pix)[\s\S]{0,80}?(\d{4}-\d{2}-\d{2})/i)
  if (isoMatch) return dateOnly(isoMatch[1])
  return ''
}

function paymentDateFromMessages(ticket: AnyRecord) {
  const messages = Array.isArray(ticket?.raw_messages)
    ? ticket.raw_messages
    : Array.isArray(ticket?.rawMessages)
      ? ticket.rawMessages
      : Array.isArray(ticket?.raw_instance?.__messages)
        ? ticket.raw_instance.__messages
        : []
  for (const msg of messages || []) {
    const body = msg?.body || msg?.text || msg?.message || msg?.comment || ''
    const explicit = dateNearPaymentText(body)
    if (explicit) return explicit
    if (textHasPaymentDoneEvidence(body) && /https?:\/\//i.test(String(body || ''))) {
      const d = dateFromAnyObject(msg)
      if (d) return d
    }
  }
  return ''
}

function paymentStatusDebug(ticket: AnyRecord) {
  const raw = ticket?.raw_instance || ticket?.rawInstance || {}
  const fmap = ticketFieldMap(ticket)
  return {
    flow: flowName(ticket) || ticket?.flow_name || ticket?.flowName || raw?.flow?.name || '',
    financeiro: isFinanceiro(ticket),
    compra: isCompra(ticket),
    result: ticket?.flow_result || ticket?.flowResult || raw?.flowResult || '',
    active: ticket?.active ?? raw?.active ?? null,
    end: dateOnly(ticket?.end_date_time || raw?.endDateTime),
    lastFinished: dateOnly(ticket?.last_finished_task_date_time || raw?.lastFinishedTaskDateTime),
    fieldPaid: dateOnly(firstField(fmap, ['dataPagamento', 'data do pagamento', 'pagoEm', 'pago em', 'dataEfetivaPagamento', 'data efetiva de pagamento', 'dataLiquidacao', 'data liquidacao', 'dataBaixa', 'data baixa'])),
    financeCompletionPaid: paymentDateFromFinanceCompletion(ticket),
    taskPaid: paymentDateFromTasks(ticket),
    messagePaid: paymentDateFromMessages(ticket),
    due: dueDateFromTicket(ticket),
    docs: zeevDocsFromTicket(ticket).length,
    source: String(ticket?.__zeev_load_source || raw?.__zeev_load_source || ''),
    loadError: String(ticket?.__zeev_load_error || raw?.__zeev_load_error || ''),
    messageError: String(ticket?.__zeev_message_error || raw?.__zeev_message_error || ''),
  }
}

async function refreshTicketFromZeev(row: AnyRecord) {
  const id = Number(row?.zeev_instance_id || row?.id || 0)
  if (!id) return row
  const base = row?.raw_instance && typeof row.raw_instance === 'object' ? { ...row.raw_instance } : {}
  base.id = base.id || id
  base.flow = base.flow || { id: row.flow_id || row.flowId || null, name: row.flow_name || row.flowName || row.request_name || '', version: row.flow_version || row.flowVersion || null }
  base.flowId = base.flowId || row.flow_id || row.flowId || null
  base.flowName = base.flowName || row.flow_name || row.flowName || ''
  base.requestName = base.requestName || row.request_name || row.requestName || ''
  base.formFields = Array.isArray(row.raw_fields) ? row.raw_fields : Array.isArray(row.rawFields) ? row.rawFields : []
  base.instanceTasks = Array.isArray(row.raw_tasks) ? row.raw_tasks : Array.isArray(row.rawTasks) ? row.rawTasks : []
  try {
    const enriched = await enrichRow(base)
    const built = await buildTicket(enriched)
    if (built) {
      await upsertTickets([built])
      return built
    }
    return genericZeevTicket(enriched, row)
  } catch (error) {
    console.warn('refreshTicketFromZeev:', error instanceof Error ? error.message : String(error))
  }
  return row
}

async function loadGenericTicketFromZeev(row: AnyRecord) {
  const id = Number(row?.zeev_instance_id || row?.ticket_raiz || row?.ticket_raiz_instance_id || row?.referencia || row?.id || 0)
  if (!id) return row
  let base: AnyRecord = row?.raw_instance && typeof row.raw_instance === 'object' ? { ...row.raw_instance } : {}
  try {
    let flowForLookup = Number(row?.flow_id || row?.flowId || row?.raw_instance?.flow?.id || row?.rawInstance?.flow?.id || 0) || 0
    if (!flowForLookup) {
      try {
        const probe = await zeevInstance(id, 0, [])
        if (probe && typeof probe === 'object') {
          base = { ...base, ...probe }
          flowForLookup = Number(probe?.flow?.id || probe?.flowId || 0) || 0
        }
      } catch (probeError) {
        console.warn('loadGenericTicketFromZeev probe:', probeError instanceof Error ? probeError.message : String(probeError))
      }
    }
    if (!flowForLookup || !base.reportLink) {
      const found = await findZeevInstanceAcrossFlows(id, flowForLookup)
      if (found.row && typeof found.row === 'object') {
        base = { ...base, ...found.row }
        flowForLookup = Number(found.row?.flow?.id || found.row?.flowId || found.flow || flowForLookup || 0) || 0
      } else if (found.errors.length) {
        base.__zeev_flow_lookup_errors = found.errors
      }
    }
    const fields = flowForLookup ? await enrichFieldsForFlow(flowForLookup) : [...new Set([
      ...FINANCE_ENRICH_FIELDS,
      ...PURCHASE_ENRICH_FIELDS,
      ...parseListEnv([env('ZEEV_EXTRA_DOCUMENT_FIELDS'), REQUEST_ZEEV_EXTRA_DOCUMENT_FIELDS].filter(Boolean).join(',')),
    ])]
    const enriched = await collectInstanceFields(id, flowForLookup, fields)
    const detail = enriched.last || {}
    base = { ...base, ...(detail || {}) }
    base.formFields = mergeFields(
      Array.isArray(base.formFields) ? base.formFields : Array.isArray(row.raw_fields) ? row.raw_fields : Array.isArray(row.rawFields) ? row.rawFields : [],
      enriched.fields,
    )
    if (enriched.errors.length) base.__zeev_load_errors = enriched.errors
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn('loadGenericTicketFromZeev:', message)
    base.__zeev_load_error = message
  }
  base.id = base.id || id
  base.flow = base.flow || { id: row.flow_id || row.flowId || null, name: row.flow_name || row.flowName || row.request_name || '', version: row.flow_version || row.flowVersion || null }
  base.flowId = base.flowId || row.flow_id || row.flowId || base.flow?.id || null
  base.flowName = base.flowName || row.flow_name || row.flowName || base.flow?.name || ''
  base.requestName = base.requestName || row.request_name || row.requestName || ''
  base.formFields = Array.isArray(base.formFields) ? base.formFields : Array.isArray(row.raw_fields) ? row.raw_fields : Array.isArray(row.rawFields) ? row.rawFields : []
  base.instanceTasks = Array.isArray(base.instanceTasks) ? base.instanceTasks : Array.isArray(row.raw_tasks) ? row.raw_tasks : Array.isArray(row.rawTasks) ? row.rawTasks : []
  const enriched = await enrichRow(base)
  const built = await buildTicket(enriched)
  if (built) {
    await upsertTickets([built])
    return built
  }
  return genericZeevTicket(enriched, row)
}

function leanFieldsForFlow(flow: number) {
  const base = FINANCE_FLOW_IDS.has(flow) ? FINANCE_ENRICH_FIELDS : PURCHASE_ENRICH_FIELDS
  const docs = parseListEnv([env('ZEEV_EXTRA_DOCUMENT_FIELDS'), REQUEST_ZEEV_EXTRA_DOCUMENT_FIELDS].filter(Boolean).join(','))
  return [...new Set([...capexFieldsForFlow(flow), ...base, ...docs])]
}

async function loadWebhookTicketFromZeev(row: AnyRecord) {
  const id = Number(row?.zeev_instance_id || row?.ticket_raiz || row?.ticket_raiz_instance_id || row?.referencia || row?.id || 0)
  if (!id) return row
  let base: AnyRecord = row?.raw_instance && typeof row.raw_instance === 'object' ? { ...row.raw_instance } : {}
  let flowForLookup = Number(row?.flow_id || row?.flowId || row?.flow?.id || row?.raw_instance?.flow?.id || row?.rawInstance?.flow?.id || 0) || 0
  try {
    const firstFields = flowForLookup ? leanFieldsForFlow(flowForLookup) : []
    const probe = await zeevInstance(id, flowForLookup, firstFields)
    if (probe && typeof probe === 'object') {
      base = { ...base, ...probe }
      flowForLookup = Number(probe?.flow?.id || probe?.flowId || flowForLookup || 0) || 0
    }
    if (flowForLookup && !hasFormFields(base)) {
      const enriched = await collectInstanceFields(id, flowForLookup, leanFieldsForFlow(flowForLookup), 10)
      base = { ...base, ...(enriched.last || {}) }
      base.formFields = mergeFields(Array.isArray(base.formFields) ? base.formFields : [], enriched.fields)
      if (enriched.errors.length) base.__zeev_load_errors = enriched.errors
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn('loadWebhookTicketFromZeev:', message)
    base.__zeev_load_error = message
  }
  base.id = base.id || id
  base.flow = base.flow || { id: row.flow_id || row.flowId || base.flow?.id || null, name: row.flow_name || row.flowName || row.request_name || base.flow?.name || '', version: row.flow_version || row.flowVersion || base.flow?.version || null }
  base.flowId = base.flowId || row.flow_id || row.flowId || base.flow?.id || null
  base.flowName = base.flowName || row.flow_name || row.flowName || base.flow?.name || ''
  base.requestName = base.requestName || row.request_name || row.requestName || ''
  base.formFields = Array.isArray(base.formFields) ? base.formFields : Array.isArray(row.raw_fields) ? row.raw_fields : Array.isArray(row.rawFields) ? row.rawFields : []
  base.instanceTasks = Array.isArray(base.instanceTasks) ? base.instanceTasks : Array.isArray(row.raw_tasks) ? row.raw_tasks : Array.isArray(row.rawTasks) ? row.rawTasks : []
  base.__skipSummaryAi = true
  const built = await buildTicket(base)
  if (built) return built
  return genericZeevTicket(base, row)
}

async function loadPaymentTicketFromZeev(row: AnyRecord) {
  const ticket = await loadGenericTicketFromZeev(row)
  const id = Number(ticket?.zeev_instance_id || row?.ticket_raiz || row?.zeev_instance_id || 0)
  if (!id) return ticket
  return await attachZeevMessagesToTicket(ticket, id)
}

async function loadTicketDocsFromZeev(row: AnyRecord) {
  const id = Number(row?.zeev_instance_id || row?.ticket_raiz || row?.ticket_raiz_instance_id || row?.referencia || row?.id || 0)
  if (!id) return row
  const baseRaw = row?.raw_instance && typeof row.raw_instance === 'object' ? { ...row.raw_instance } : {}
  const preferredFlow = Number(row?.flow_id || row?.flowId || baseRaw?.flow?.id || baseRaw?.flowId || 0) || 0
  const baseFields = Array.isArray(row?.raw_fields) ? row.raw_fields : Array.isArray(row?.rawFields) ? row.rawFields : Array.isArray(baseRaw?.formFields) ? baseRaw.formFields : []
  const baseTasks = Array.isArray(row?.raw_tasks) ? row.raw_tasks : Array.isArray(row?.rawTasks) ? row.rawTasks : Array.isArray(baseRaw?.instanceTasks) ? baseRaw.instanceTasks : []
  const errors: AnyRecord[] = []
  let detail: AnyRecord = { ...baseRaw, id, formFields: baseFields, instanceTasks: baseTasks }
  let flowUsed = preferredFlow
  for (const flow of knownZeevFlowIds(preferredFlow)) {
    let flowMatched = false
    let flowFields: AnyRecord[] = []
    try {
      const fields = await documentFieldsForFlow(flow)
      const chunkSize = Math.max(2, Math.min(Number(env('ZEEV_DOC_FIELD_CHUNK_SIZE', '6')) || 6, 12))
      for (let i = 0; i < fields.length; i += chunkSize) {
        const chunk = fields.slice(i, i + chunkSize)
        try {
          const fresh = await zeevInstanceReport(id, flow, chunk)
          if (fresh && typeof fresh === 'object' && (Number(fresh.id) === id || Array.isArray(fresh.formFields))) {
            detail = { ...detail, ...fresh }
            flowFields = mergeFields(flowFields, Array.isArray(fresh.formFields) ? fresh.formFields : [])
            flowUsed = Number(fresh?.flow?.id || fresh?.flowId || flow) || flow
            flowMatched = true
          }
        } catch (error) {
          errors.push({ flow, fields: chunk.join(',').slice(0, 180), error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300) })
        }
      }
    } catch (error) {
      errors.push({ flow, error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300) })
    }
    if (flowMatched) {
      detail.formFields = mergeFields(Array.isArray(detail.formFields) ? detail.formFields : [], flowFields)
      break
    }
  }
  const merged = {
    ...row,
    zeev_instance_id: id,
    flow_id: row?.flow_id || row?.flowId || detail?.flow?.id || detail?.flowId || flowUsed || null,
    flow_name: row?.flow_name || row?.flowName || detail?.flow?.name || detail?.flowName || detail?.requestName || '',
    request_name: row?.request_name || row?.requestName || detail?.requestName || '',
    raw_fields: mergeFields(baseFields, Array.isArray(detail?.formFields) ? detail.formFields : []),
    raw_tasks: Array.isArray(detail?.instanceTasks) && detail.instanceTasks.length ? detail.instanceTasks : baseTasks,
    raw_instance: {
      ...baseRaw,
      ...detail,
      __zeev_load_source: 'zeev-docs-only',
      __zeev_doc_lookup_errors: errors,
    },
    __zeev_load_source: 'zeev-docs-only',
  }
  return await attachZeevMessagesToTicket(merged, id)
}

async function attachZeevMessagesToTicket(ticket: AnyRecord, id: number) {
  if (!id) return ticket
  try {
    const messages = await zeevMessages(id)
    return {
      ...ticket,
      __zeev_load_source: ticket?.__zeev_load_source || 'zeev-instance',
      raw_messages: messages,
      raw_instance: {
        ...(ticket?.raw_instance || {}),
        __zeev_load_source: ticket?.__zeev_load_source || 'zeev-instance',
        __messages: messages,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn('loadPaymentTicketFromZeev messages:', message)
    return {
      ...ticket,
      __zeev_message_error: message,
      raw_instance: {
        ...(ticket?.raw_instance || {}),
        __zeev_message_error: message,
      },
    }
  }
  return ticket
}

function genericZeevTicket(enriched: AnyRecord, fallback: AnyRecord = {}) {
  const fields = Array.isArray(enriched?.formFields) ? enriched.formFields : Array.isArray(fallback?.raw_fields) ? fallback.raw_fields : []
  const tasks = Array.isArray(enriched?.instanceTasks) ? enriched.instanceTasks : Array.isArray(fallback?.raw_tasks) ? fallback.raw_tasks : []
  const fmap = fieldMap(fields)
  const financeiro = isFinanceiro(enriched)
  const compra = isCompra(enriched)
  const itens = extractItems(fields)
  const pagamento = extractPagamento(fmap)
  const valor = pickTicketValue(fmap, itens, financeiro)
  const desc = ticketDescription(fmap, itens, financeiro, compra)
  return {
    zeev_instance_id: Number(enriched?.id || fallback?.zeev_instance_id || fallback?.ticket_raiz || fallback?.ticket_raiz_instance_id || 0) || null,
    zeev_uid: enriched?.uid || fallback.zeev_uid || null,
    flow_id: flowId(enriched) || fallback.flow_id || null,
    flow_name: flowName(enriched) || fallback.flow_name || '',
    flow_version: flowVersion(enriched) || fallback.flow_version || null,
    request_name: enriched?.requestName || fallback.request_name || null,
    ticket_link: enriched?.reportLink || enriched?.reportUrl || fallback.ticket_link || fallback.ticket_raiz_url || null,
    confirmation_code: enriched?.confirmationCode || fallback.confirmation_code || null,
    start_date_time: iso(enriched?.startDateTime || fallback.start_date_time),
    end_date_time: iso(enriched?.endDateTime || fallback.end_date_time),
    last_finished_task_date_time: iso(enriched?.lastFinishedTaskDateTime || fallback.last_finished_task_date_time),
    active: enriched?.active === undefined ? fallback.active ?? null : Boolean(enriched.active),
    flow_result: enriched?.flowResult || fallback.flow_result || '',
    requester_name: enriched?.requester?.name || fallback.requester_name || '',
    requester_email: enriched?.requester?.email || fallback.requester_email || '',
    requester_username: enriched?.requester?.username || fallback.requester_username || '',
    requester_team: enriched?.requester?.team?.name || fallback.requester_team || '',
    etapa_atual: taskName(currentTask(tasks)),
    valor: valor || fallback.valor || null,
    valor_final: fallback.valor_final || null,
    valor_status: valor ? 'estimado' : 'nao_encontrado',
    unidade: firstField(fmap, ['unidadeEscolar', 'unidade', 'escola', 'filial', 'localEntrega']) || cleanUnit(firstField(fmap, ['centroDeCusto', 'centroCusto'])) || fallback.unidade || null,
    marca: firstField(fmap, ['marca']) || fallback.marca || null,
    pedido: desc || fallback.pedido || null,
    categoria_capex: firstField(fmap, ['categoriaCompra', 'categoria', 'tipoCompra']) || fallback.categoria_capex || null,
    fonte: fallback.fonte || 'UNIDADE',
    setor: financeiro ? 'FINANCEIRO' : 'COMPRAS',
    raw_fields: fields,
    raw_instance: enriched || fallback,
    raw_tasks: tasks,
    itens_json: itens,
    pagamento_json: { ...pagamento, valor_total: valor || null },
    campos_extraidos: fieldsObject(fields),
  }
}

function ticketFromCapexDados(row: AnyRecord) {
  const dados = row?.ticket_raiz_dados && typeof row.ticket_raiz_dados === 'object' ? row.ticket_raiz_dados : {}
  return {
    zeev_instance_id: Number(row.ticket_raiz_instance_id || row.referencia || 0) || null,
    ticket_link: row.ticket_raiz_url || '',
    campos_extraidos: dados.campos || {},
    raw_fields: dados.rawFields || [],
    itens_json: dados.itens || [],
    pagamento_json: dados.pagamento || {},
  }
}

async function loadTicketsByIds(ids: number[]) {
  const out = new Map<number, AnyRecord>()
  const clean = [...new Set(ids.map((id) => Number(id)).filter(Boolean))]
  for (let i = 0; i < clean.length; i += 100) {
    const chunk = clean.slice(i, i + 100)
    const rows = await rest(`/capex_zeev_solicitacoes?zeev_instance_id=in.(${chunk.join(',')})&select=*`)
    for (const row of rows || []) out.set(Number(row.zeev_instance_id), row)
  }
  return out
}

function ticketHasStoredZeevData(ticket: AnyRecord) {
  return Boolean(
    (Array.isArray(ticket?.raw_fields) && ticket.raw_fields.length) ||
    (Array.isArray(ticket?.rawFields) && ticket.rawFields.length) ||
    (Array.isArray(ticket?.raw_tasks) && ticket.raw_tasks.length) ||
    (Array.isArray(ticket?.rawTasks) && ticket.rawTasks.length) ||
    (ticket?.raw_instance && typeof ticket.raw_instance === 'object') ||
    (ticket?.rawInstance && typeof ticket.rawInstance === 'object'),
  )
}

function normalizeStoredTicketSnapshot(ticket: AnyRecord, ticketId: number) {
  const rawInstance = ticket?.raw_instance && typeof ticket.raw_instance === 'object'
    ? ticket.raw_instance
    : ticket?.rawInstance && typeof ticket.rawInstance === 'object'
      ? ticket.rawInstance
      : {}
  return {
    ...ticket,
    zeev_instance_id: Number(ticket?.zeev_instance_id || ticketId) || ticketId,
    raw_fields: Array.isArray(ticket?.raw_fields) ? ticket.raw_fields : Array.isArray(ticket?.rawFields) ? ticket.rawFields : Array.isArray(rawInstance?.formFields) ? rawInstance.formFields : [],
    raw_tasks: Array.isArray(ticket?.raw_tasks) ? ticket.raw_tasks : Array.isArray(ticket?.rawTasks) ? ticket.rawTasks : Array.isArray(rawInstance?.instanceTasks) ? rawInstance.instanceTasks : [],
    raw_instance: {
      ...rawInstance,
      __zeev_load_source: 'stored-report',
    },
    __zeev_load_source: 'stored-report',
  }
}

async function loadPaymentTicketForRefresh(row: AnyRecord, storedTicket: AnyRecord | undefined) {
  const ticketId = Number(ticketDigits(row.ticket_raiz))
  if (storedTicket && ticketHasStoredZeevData(storedTicket)) {
    return await attachZeevMessagesToTicket(normalizeStoredTicketSnapshot(storedTicket, ticketId), ticketId)
  }
  return await loadPaymentTicketFromZeev({ zeev_instance_id: ticketId, ticket_raiz: ticketId })
}

async function attachDocsForTarget(target: 'pending' | 'payment' | 'capex', row: AnyRecord, ticket: AnyRecord, limitFiles: number) {
  const stored = normalizeStoredDocs(row)
  const docs = zeevDocsFromTicket(ticket)
    .filter((doc) => doc.url || doc.base64Content || doc.fileId)
    .sort((a: AnyRecord, b: AnyRecord) => financialDocPriority(a) - financialDocPriority(b))
  let attached = 0
  let nfPath = row.nf_doc_path || ''
  let compPath = row.comp_doc_path || ''
  const skipped: AnyRecord[] = []
  const deduped: AnyRecord[] = []
  const ignored: AnyRecord[] = []
  const newDocs: AnyRecord[] = []
  const storedHashCache = new Map<string, string>()
  const ticketId = ticketDigits(ticket.zeev_instance_id || row.ticket_raiz || row.ticket_raiz_instance_id || row.referencia || '')
  let effectiveCandidateCount = 0
  let hasInvoiceCandidate = false
  let hasChargeCandidate = false
  let hasProofCandidate = false
  const markCandidateKind = (kind: string) => {
    effectiveCandidateCount++
    if (isInvoiceDocKind(kind)) hasInvoiceCandidate = true
    else if (isChargeDocKind(kind)) hasChargeCandidate = true
    else if (isProofDocKind(kind)) hasProofCandidate = true
  }
  const requestedLimit = Math.max(1, Number(limitFiles || 1))
  const attachAllDocs = !['0', 'false', 'nao', 'no', 'off'].includes(String(env('ZEEV_ATTACH_ALL_TICKET_DOCS', '1')).toLowerCase())
  const perTicketCap = Math.max(requestedLimit, Math.min(Number(env('ZEEV_DOC_ATTACH_PER_TICKET_LIMIT', '40')) || 40, 80))
  const effectiveLimit = attachAllDocs ? perTicketCap : Math.min(perTicketCap, Math.max(requestedLimit, hasInvoiceCandidate && hasChargeCandidate ? 2 : requestedLimit))
  const candidateLimit = Math.max(effectiveLimit, Math.min(Number(env('ZEEV_DOC_CANDIDATE_ATTEMPT_LIMIT', '50')) || 50, 120))
  for (const doc of docs.slice(0, candidateLimit)) {
    if (attached >= effectiveLimit) break
    const docKind = fiscalDocKind(doc)
    if (isAlwaysIgnoredZeevDocCandidate(doc)) {
      if (ignored.length < 8) ignored.push({ name: doc.name || '', source: doc.source || '', kind: docKind, reason: 'campo_de_formulario_sem_arquivo' })
      continue
    }
    const docNameKey = `${docKind}|${normKey(doc.name)}|${normKey(doc.source)}`
    const sameZeevFileAlreadyStored = stored.some((existing) => {
      const sameName = normKey(existing?.name) && normKey(existing?.name) === normKey(doc.name)
      const ze = String(existing?.origin || '').toUpperCase() === 'ZEEV' || String(existing?.storagePath || '').includes('zeev_tr_') || String(existing?.storagePath || '').includes('zeev_pendente/')
      return sameName && ze && Boolean(existing?.storagePath || existing?.path || existing?.url)
    })
    if (sameZeevFileAlreadyStored) {
      markCandidateKind(docKind)
      continue
    }
    if (stored.some((existing) => String(existing.url || '') && String(existing.url) === String(doc.url))) {
      markCandidateKind(docKind)
      continue
    }
    if (!doc.url && stored.some((existing) => `${existing.kind || ''}|${normKey(existing.name)}|${normKey(existing.source)}` === docNameKey)) {
      markCandidateKind(docKind)
      continue
    }
    let file: { body: ArrayBuffer; name: string; type: string } | null = null
    try {
      file = await downloadZeevDoc(doc)
    } catch (error) {
      if (isIgnorableHtmlDownloadError(doc, error)) {
        if (ignored.length < 8) ignored.push({ name: doc.name || '', source: doc.source || '', kind: docKind, reason: 'html_sem_arquivo_baixavel' })
        continue
      }
      markCandidateKind(docKind)
      if (skipped.length < 8) {
        skipped.push({
          name: doc.name || '',
          source: doc.source || '',
          hasUrl: Boolean(doc.url),
          hasFileId: Boolean(doc.fileId),
          reason: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
        })
      }
      continue
    }
    if (!file) continue
    const kind = docKind
    markCandidateKind(kind)
    const fileHash = await sha256Hex(file.body)
    if (await storedDocMatchesDownloadedFile(stored, kind, ticketId, file, fileHash, storedHashCache)) {
      if (deduped.length < 8) {
        deduped.push({
          name: file.name || doc.name || '',
          source: doc.source || '',
          kind,
          reason: 'arquivo_equivalente_ja_anexado',
        })
      }
      continue
    }
    const scope = target === 'payment'
      ? `obra_${row.obra_id || 'sem_obra'}/zeev_tr_${ticketId || 'sem_tr'}`
      : target === 'pending'
        ? `zeev_pendente/zeev_tr_${ticketId || 'sem_tr'}`
        : `capex/zeev_tr_${ticketId || 'sem_tr'}`
    const path = `${scope}/${kind.toLowerCase()}_${Date.now()}_${attached + 1}_${file.name}`
    await uploadPaymentStorage(path, file)
    const item = { name: file.name, storagePath: path, type: file.type, bucket: 'pagamentos', kind, origin: 'ZEEV', source: doc.source || '', url: doc.url || '', ticketRaiz: ticketId, sha256: fileHash, size: file.body.byteLength, attachedAt: new Date().toISOString() }
    stored.push(item)
    newDocs.push(item)
    if (!nfPath && isInvoiceDocKind(kind)) nfPath = path
    if (!compPath && isProofDocKind(kind)) compPath = path
    attached++
  }
  const audit = buildZeevDocAudit(target, row, ticket, stored, {
    attached,
    skipped,
    deduped,
    ignored,
    effectiveCandidateCount,
    rawCandidateCount: docs.length,
    candidateCount: docs.length,
    attemptedCandidateCount: Math.min(docs.length, candidateLimit),
    unattemptedCandidateCount: Math.max(0, docs.length - candidateLimit),
    hasInvoiceCandidate,
    hasChargeCandidate,
    hasProofCandidate,
  })
  return { docs: withLatestZeevDocAudit(stored, audit), audit, attached, nfPath, compPath, skipped, deduped, ignored, newDocs, candidateCount: effectiveCandidateCount, rawCandidateCount: docs.length, attemptedCandidateCount: Math.min(docs.length, candidateLimit), unattemptedCandidateCount: Math.max(0, docs.length - candidateLimit), reachedFileLimit: docs.length > candidateLimit || attached >= effectiveLimit }
}

function recordAttachedDocs(out: AnyRecord, target: string, row: AnyRecord, ticket: AnyRecord, attach: AnyRecord) {
  if (!attach?.attached) return
  if (!Array.isArray(out.attachedTickets)) out.attachedTickets = []
  if (out.attachedTickets.length >= 80) return
  const ticketId = ticketDigits(ticket?.zeev_instance_id || row?.ticket_raiz || row?.ticket_raiz_instance_id || row?.referencia || '')
  const attachments = (Array.isArray(attach.newDocs) ? attach.newDocs : [])
    .map((doc: AnyRecord) => ({
      name: doc?.name || '',
      kind: doc?.kind || '',
      storagePath: doc?.storagePath || '',
      attachedAt: doc?.attachedAt || '',
    }))
  const invoiceDocs = attachments.filter((doc: AnyRecord) => isInvoiceDocKind(doc.kind))
  const chargeDocs = attachments.filter((doc: AnyRecord) => isChargeDocKind(doc.kind))
  const proofDocs = attachments.filter((doc: AnyRecord) => isProofDocKind(doc.kind))
  if (!attachments.length) return
  out.attachedTickets.push({
    tr: ticketId ? Number(ticketId) : null,
    target,
    rowId: row?.id || null,
    attachments,
    invoiceDocs,
    chargeDocs,
    proofDocs,
    fiscalDocs: invoiceDocs,
  })
}

function checkedRowWithAttach(row: AnyRecord, attach: AnyRecord) {
  return {
    ...row,
    docs_json: Array.isArray(attach?.docs) ? attach.docs : row?.docs_json,
    nf_doc_path: attach?.nfPath || row?.nf_doc_path || '',
    comp_doc_path: attach?.compPath || row?.comp_doc_path || '',
  }
}

function recordCheckedWithoutFiscalDoc(out: AnyRecord, target: string, row: AnyRecord, ticket: AnyRecord, attach: AnyRecord) {
  if (hasStoredFiscalDoc(checkedRowWithAttach(row, attach))) return
  out.checkedWithoutFiscal = Number(out.checkedWithoutFiscal || 0) + 1
  if (!Array.isArray(out.checkedWithoutFiscalTickets)) out.checkedWithoutFiscalTickets = []
  if (out.checkedWithoutFiscalTickets.length >= 80) return
  const ticketId = ticketDigits(ticket?.zeev_instance_id || row?.ticket_raiz || row?.ticket_raiz_instance_id || row?.referencia || '')
  out.checkedWithoutFiscalTickets.push({
    tr: ticketId ? Number(ticketId) : null,
    target,
    rowId: row?.id || null,
    checkedAt: new Date().toISOString(),
  })
}

function numberInput(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readDocStaleHours(input: AnyRecord, fallback = 8, max = 720) {
  return Math.max(0, Math.min(numberInput(input?.staleHours ?? input?.stale_hours, fallback), max))
}

function readDocCheckedBefore(input: AnyRecord) {
  const raw = String(input?.checkedBefore ?? input?.checked_before ?? input?.scanStartedAt ?? input?.scan_started_at ?? '').trim()
  if (!raw) return 0
  const ts = new Date(raw).getTime()
  return Number.isFinite(ts) ? ts : 0
}

function docsCheckIsStale(row: AnyRecord, hours: number) {
  if (Number(hours) <= 0) return true
  const checked = row?.zeev_docs_checked_at ? new Date(row.zeev_docs_checked_at).getTime() : 0
  if (!checked || Number.isNaN(checked)) return true
  return Date.now() - checked > Math.max(1, hours) * 3600 * 1000
}

function docsNeedRescue(row: AnyRecord, staleHours: number, checkedBefore = 0) {
  if (checkedBefore > 0) {
    const checked = row?.zeev_docs_checked_at ? new Date(row.zeev_docs_checked_at).getTime() : 0
    return !checked || Number.isNaN(checked) || checked < checkedBefore
  }
  const audit = latestZeevDocAudit(row)
  if (audit) {
    if (docsCheckIsStale(row, staleHours)) return true
    const retryAt = zeevDocAuditRetryAt(audit)
    if (auditStatusNeedsAttention(audit.status) && retryAt > 0 && Date.now() >= retryAt) return true
    return false
  }
  return docsCheckIsStale(row, staleHours)
}

function docsCandidateScore(row: AnyRecord) {
  const docs = normalizeStoredDocs(row).length
  const checked = row?.zeev_docs_checked_at ? new Date(row.zeev_docs_checked_at).getTime() : 0
  const paidMissing = row?.ticket_raiz && !(row?.st === 'PAGO' && row?.paga_em) ? -2 : 0
  return (docs ? 1000 : 0) + (checked || 0) / 1000000000000 + paidMissing
}

function obraSortValue(row: AnyRecord) {
  const id = Number(row?.obra_id || 0)
  return id > 0 ? id : Number.MAX_SAFE_INTEGER
}

function comparePaymentDocCandidates(a: AnyRecord, b: AnyRecord) {
  return obraSortValue(a) - obraSortValue(b)
    || Number(a?.id || 0) - Number(b?.id || 0)
    || docsCandidateScore(a) - docsCandidateScore(b)
}

function hasStoredFiscalDoc(row: AnyRecord) {
  if (String(row?.nf_doc_path || '').trim()) return true
  return normalizeStoredDocs(row).some((doc: AnyRecord) => {
    const kind = fiscalDocKind(doc)
    return isInvoiceDocKind(kind) && Boolean(doc?.storagePath || doc?.path || doc?.url)
  })
}

function hasStoredChargeDoc(row: AnyRecord) {
  return normalizeStoredDocs(row).some((doc: AnyRecord) => {
    const kind = fiscalDocKind(doc)
    return isChargeDocKind(kind) && Boolean(doc?.storagePath || doc?.path || doc?.url)
  })
}

function hasStoredProofDoc(row: AnyRecord) {
  if (String(row?.comp_doc_path || '').trim()) return true
  return normalizeStoredDocs(row).some((doc: AnyRecord) => {
    const kind = fiscalDocKind(doc)
    return isProofDocKind(kind) && Boolean(doc?.storagePath || doc?.path || doc?.url)
  })
}

function shouldRescueDocs(row: AnyRecord, staleHours: number, target: 'payment' | 'pending' | 'capex' | 'generic' = 'generic', checkedBefore = 0) {
  if (target === 'payment' && !hasStoredFiscalDoc(row)) return docsNeedRescue(row, staleHours, checkedBefore)
  if (!normalizeStoredDocs(row).length) return docsNeedRescue(row, staleHours, checkedBefore)
  return docsNeedRescue(row, staleHours, checkedBefore)
}

function stableHash(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function obraDoneEmailEnabled() {
  const value = String(env('ZEEV_OBRA_DONE_EMAIL', 'true') || '').trim().toLowerCase()
  return !['0', 'false', 'nao', 'no', 'off', 'desligado'].includes(value)
}

function docKindsForRow(row: AnyRecord) {
  const docs = normalizeStoredDocs(row)
  const kinds = docs.map((doc: AnyRecord) => fiscalDocKind(doc))
  return {
    docs,
    hasAny: Boolean(docs.length || row?.nf_doc_path || row?.comp_doc_path),
    hasFiscal: hasStoredFiscalDoc(row),
    hasCharge: kinds.some((kind) => isChargeDocKind(kind)),
    hasProof: kinds.some((kind) => isProofDocKind(kind)),
  }
}

async function loadObraInfoMap(obraIds: number[]) {
  const unique = uniqueNumbers(obraIds).filter((id) => id > 0)
  const map = new Map<number, AnyRecord>()
  for (let i = 0; i < unique.length; i += 80) {
    const chunk = unique.slice(i, i + 80)
    const rows = await rest(`/obras?select=id,nome,marca,unidades_obra&id=in.(${chunk.join(',')})`)
    for (const row of rows || []) map.set(Number(row.id), row)
  }
  return map
}

async function summarizeObraDocScan(obraId: number, staleHours: number, obraInfo: AnyRecord | null = null) {
  const rowsRaw = await restAll(`/pagamentos?select=id,obra_id,ticket_raiz,ben,v,ref,nf_doc_path,comp_doc_path,docs_json,st,paga_em,venc,zeev_docs_checked_at&obra_id=eq.${Number(obraId)}&ticket_raiz=not.is.null&order=id.asc`)
  const rows = (rowsRaw || []).filter((row: AnyRecord) => ticketDigits(row.ticket_raiz))
  if (!rows.length) return null
  const uniqueTrs = new Set<string>()
  let totalValue = 0
  let withAnyRows = 0
  let withFiscalRows = 0
  let withChargeRows = 0
  let withProofRows = 0
  let checkedRows = 0
  let latestCheckedAt = ''
  const staleRows: AnyRecord[] = []
  const missingFiscalRows: AnyRecord[] = []
  const docFingerprints: string[] = []
  for (const row of rows) {
    const tr = ticketDigits(row.ticket_raiz)
    if (tr) uniqueTrs.add(tr)
    totalValue += Number(row.v || 0) || 0
    const state = docKindsForRow(row)
    if (state.hasAny) withAnyRows++
    if (state.hasFiscal) withFiscalRows++
    if (state.hasCharge) withChargeRows++
    if (state.hasProof) withProofRows++
    if (row.zeev_docs_checked_at && !docsCheckIsStale(row, staleHours)) checkedRows++
    if (row.zeev_docs_checked_at && (!latestCheckedAt || String(row.zeev_docs_checked_at) > latestCheckedAt)) latestCheckedAt = String(row.zeev_docs_checked_at)
    if (docsCheckIsStale(row, staleHours)) staleRows.push(row)
    if (!state.hasFiscal) missingFiscalRows.push(row)
    const docKey = state.docs
      .map((doc: AnyRecord) => `${fiscalDocKind(doc)}:${storedDocKey(doc)}`)
      .sort()
      .join(',')
    docFingerprints.push(`${row.id}:${tr}:${state.hasFiscal ? 1 : 0}:${state.hasCharge ? 1 : 0}:${docKey}`)
  }
  const maxPaymentId = Math.max(...rows.map((row: AnyRecord) => Number(row.id || 0)))
  const docHash = stableHash(docFingerprints.join('|'))
  const signature = `obra-doc-v2:${obraId}:${rows.length}:${uniqueTrs.size}:${withFiscalRows}:${withChargeRows}:${withProofRows}:${missingFiscalRows.length}:${maxPaymentId}:${stableHash(String(Math.round(totalValue * 100)))}:${docHash}`
  return {
    obraId: Number(obraId),
    obra: obraInfo || null,
    complete: staleRows.length === 0,
    staleRows: staleRows.length,
    checkedRows,
    totalRows: rows.length,
    uniqueTickets: uniqueTrs.size,
    totalValue,
    withAnyRows,
    withFiscalRows,
    withChargeRows,
    withProofRows,
    missingFiscalRows: missingFiscalRows.length,
    latestCheckedAt,
    signature,
    missingFiscalSample: missingFiscalRows
      .sort((a: AnyRecord, b: AnyRecord) => Number(ticketDigits(a.ticket_raiz)) - Number(ticketDigits(b.ticket_raiz)) || Number(a.id) - Number(b.id))
      .slice(0, 20)
      .map((row: AnyRecord) => ({
        tr: Number(ticketDigits(row.ticket_raiz)),
        beneficiario: row.ben || '',
        valor: Number(row.v || 0) || 0,
        status: row.st || '',
      })),
  }
}

async function sendObraDocScanEmail(summary: AnyRecord) {
  const obra = summary.obra || {}
  const nome = String(obra.nome || `Obra ${summary.obraId}`)
  const marca = String(obra.marca || '').trim()
  const missingRows = Array.isArray(summary.missingFiscalSample) ? summary.missingFiscalSample : []
  const missingHtml = missingRows.length
    ? `<div style="margin-top:16px">
        <p style="margin:0 0 8px"><b>TRs ainda sem NF/DANFE/XML anexado</b> <span style="color:#6b6257">(primeiros ${missingRows.length})</span></p>
        <table style="border-collapse:collapse;width:100%;font-size:13px">
          <thead>
            <tr>
              <th align="left" style="border-bottom:1px solid #e6d8c5;padding:6px">TR</th>
              <th align="left" style="border-bottom:1px solid #e6d8c5;padding:6px">Beneficiario</th>
              <th align="right" style="border-bottom:1px solid #e6d8c5;padding:6px">Valor</th>
              <th align="left" style="border-bottom:1px solid #e6d8c5;padding:6px">Status</th>
            </tr>
          </thead>
          <tbody>
            ${missingRows.map((row: AnyRecord) => `
              <tr>
                <td style="border-bottom:1px solid #f3eadf;padding:6px">${htmlEscape(row.tr || '')}</td>
                <td style="border-bottom:1px solid #f3eadf;padding:6px">${htmlEscape(row.beneficiario || 'Nao informado')}</td>
                <td align="right" style="border-bottom:1px solid #f3eadf;padding:6px">${htmlEscape(formatBrMoney(row.valor || 0))}</td>
                <td style="border-bottom:1px solid #f3eadf;padding:6px">${htmlEscape(row.status || 'Nao informado')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`
    : '<p style="margin:16px 0 0;color:#28704f"><b>Todos os pagamentos checados desta obra ja possuem NF/DANFE/XML anexado.</b></p>'
  const html = `
    <div style="font-family:Arial,sans-serif;color:#173C34;line-height:1.5;background:#fffaf3;padding:20px;border-radius:12px">
      <p style="margin:0 0 6px;color:#a35a00;text-transform:uppercase;letter-spacing:.04em;font-size:12px"><b>Varredura Zeev concluida por obra</b></p>
      <h2 style="margin:0 0 4px">${htmlEscape(nome)}</h2>
      ${marca ? `<p style="margin:0 0 16px;color:#5c6b62"><b>Marca:</b> ${htmlEscape(marca)}</p>` : ''}
      <table style="border-collapse:separate;border-spacing:0 8px;width:100%;font-size:14px">
        <tbody>
          <tr>
            <td style="background:#ffffff;border:1px solid #eadcc9;border-radius:10px;padding:10px"><b>Lancamentos com TR</b><br>${htmlEscape(summary.totalRows)}</td>
            <td style="background:#ffffff;border:1px solid #eadcc9;border-radius:10px;padding:10px"><b>TRs unicos</b><br>${htmlEscape(summary.uniqueTickets)}</td>
            <td style="background:#ffffff;border:1px solid #eadcc9;border-radius:10px;padding:10px"><b>Valor auditado</b><br>${htmlEscape(formatBrMoney(summary.totalValue))}</td>
          </tr>
          <tr>
            <td style="background:#ffffff;border:1px solid #eadcc9;border-radius:10px;padding:10px"><b>Com NF/DANFE/XML</b><br>${htmlEscape(summary.withFiscalRows)}</td>
            <td style="background:#ffffff;border:1px solid #eadcc9;border-radius:10px;padding:10px"><b>Com boleto/fatura</b><br>${htmlEscape(summary.withChargeRows)}</td>
            <td style="background:#ffffff;border:1px solid #eadcc9;border-radius:10px;padding:10px"><b>Com comprovante</b><br>${htmlEscape(summary.withProofRows)}</td>
          </tr>
        </tbody>
      </table>
      <p style="margin:10px 0 0"><b>Ultima checagem:</b> ${htmlEscape(formatBrDateTime(summary.latestCheckedAt))}</p>
      <p style="margin:4px 0 0"><b>Resultado:</b> todos os pagamentos com TR desta obra foram checados pela varredura controlada. ${summary.missingFiscalRows ? `${htmlEscape(summary.missingFiscalRows)} lancamento(s) continuam sem documento fiscal localizado no Zeev.` : 'Nao ha documento fiscal faltante nos lancamentos checados.'}</p>
      ${missingHtml}
    </div>`
  return await sendHtmlEmail(`Raiz ObraViva - varredura concluida: ${nome}`, html)
}

async function notifyCompletedObraDocScans(obraIds: number[], staleHours: number) {
  if (!obraDoneEmailEnabled()) return []
  const unique = uniqueNumbers(obraIds).filter((id) => id > 0)
  if (!unique.length) return []
  const obraMap = await loadObraInfoMap(unique)
  const sent: AnyRecord[] = []
  for (const obraId of unique) {
    const summary = await summarizeObraDocScan(obraId, staleHours, obraMap.get(obraId) || null)
    if (!summary || !summary.complete) {
      sent.push({ obraId, sent: false, skipped: true, reason: 'obra_ainda_tem_registros_pendentes_de_checagem', staleRows: summary?.staleRows ?? null })
      continue
    }
    const stateId = `zeev-obra-docs-${obraId}`
    const state = await getState(stateId)
    if (String(state?.last_error || '') === summary.signature) {
      sent.push({ obraId, sent: false, skipped: true, reason: 'relatorio_ja_enviado_para_esta_assinatura' })
      continue
    }
    const result = await sendObraDocScanEmail(summary)
    if (result.sent) {
      await saveState(stateId, {
        running: false,
        last_success_at: new Date().toISOString(),
        last_error: summary.signature,
        last_run_found: summary.totalRows,
        last_run_new: summary.withFiscalRows,
        last_run_updated: summary.withChargeRows,
      })
      sent.push({
        obraId,
        obra: summary.obra?.nome || `Obra ${obraId}`,
        sent: true,
        provider: result.provider,
        totalRows: summary.totalRows,
        uniqueTickets: summary.uniqueTickets,
        withFiscalRows: summary.withFiscalRows,
        withChargeRows: summary.withChargeRows,
        missingFiscalRows: summary.missingFiscalRows,
      })
    } else {
      sent.push({ obraId, obra: summary.obra?.nome || `Obra ${obraId}`, sent: false, reason: result.reason || 'falha_no_envio' })
    }
  }
  return sent
}

function flattenAttachedTickets(value: unknown) {
  const rows: AnyRecord[] = []
  const pushTicket = (ticket: AnyRecord) => {
    if (!ticket || typeof ticket !== 'object') return
    const docs = Array.isArray(ticket.attachments)
      ? ticket.attachments
      : Array.isArray(ticket.fiscalDocs)
        ? ticket.fiscalDocs
        : []
    for (const doc of docs) {
      if (!doc || typeof doc !== 'object') continue
      rows.push({
        tr: ticket.tr || ticket.ticket || ticket.ticketRaiz || ticket.zeev_instance_id || '',
        target: ticket.target || ticket.alvo || '',
        kind: doc.kind || doc.tipo || fiscalDocKind(doc),
        name: doc.name || doc.nome || '',
        attachedAt: doc.attachedAt || doc.anexadoEm || '',
        storagePath: doc.storagePath || doc.path || '',
      })
    }
  }
  const walk = (item: unknown) => {
    if (Array.isArray(item)) {
      for (const nested of item) walk(nested)
      return
    }
    if (!item || typeof item !== 'object') return
    const obj = item as AnyRecord
    if (Array.isArray(obj.attachedTickets)) for (const ticket of obj.attachedTickets) pushTicket(ticket)
    if (Array.isArray(obj.recentAttached?.tickets)) for (const ticket of obj.recentAttached.tickets) pushTicket(ticket)
    if (Array.isArray(obj.batches)) for (const batch of obj.batches) walk(batch)
    if (Array.isArray(obj.roundResults)) for (const round of obj.roundResults) walk(round)
    if (obj.directDocs) walk(obj.directDocs)
    if (obj.scheduled) walk(obj.scheduled)
    if (obj.backfill) walk(obj.backfill)
  }
  walk(value)
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = String(row.storagePath || `${row.tr}|${row.target}|${row.kind}|${row.name}|${row.attachedAt}`)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function rescueBlockReportEnabled() {
  const value = String(env('ZEEV_RESCUE_BLOCK_EMAIL', 'true') || '').trim().toLowerCase()
  return !['0', 'false', 'nao', 'no', 'off', 'desligado'].includes(value)
}

function attachmentRowsHtml(rows: AnyRecord[]) {
  if (!rows.length) return '<p style="margin:14px 0 0;color:#6b6257">Nenhum arquivo novo anexado neste bloco.</p>'
  const limited = rows.slice(0, 60)
  return `<div style="margin-top:16px">
    <p style="margin:0 0 8px"><b>Arquivos anexados neste bloco</b>${rows.length > limited.length ? ` <span style="color:#6b6257">(primeiros ${limited.length} de ${rows.length})</span>` : ''}</p>
    <table style="border-collapse:collapse;width:100%;font-size:12px">
      <thead>
        <tr>
          <th align="left" style="border-bottom:1px solid #e6d8c5;padding:6px">TR</th>
          <th align="left" style="border-bottom:1px solid #e6d8c5;padding:6px">Alvo</th>
          <th align="left" style="border-bottom:1px solid #e6d8c5;padding:6px">Tipo</th>
          <th align="left" style="border-bottom:1px solid #e6d8c5;padding:6px">Arquivo</th>
          <th align="left" style="border-bottom:1px solid #e6d8c5;padding:6px">Horario</th>
        </tr>
      </thead>
      <tbody>
        ${limited.map((row: AnyRecord) => `
          <tr>
            <td style="border-bottom:1px solid #f3eadf;padding:6px">${htmlEscape(row.tr || '')}</td>
            <td style="border-bottom:1px solid #f3eadf;padding:6px">${htmlEscape(row.target || '')}</td>
            <td style="border-bottom:1px solid #f3eadf;padding:6px">${htmlEscape(row.kind || '')}</td>
            <td style="border-bottom:1px solid #f3eadf;padding:6px">${htmlEscape(row.name || row.storagePath || '')}</td>
            <td style="border-bottom:1px solid #f3eadf;padding:6px">${htmlEscape(formatBrDateTime(row.attachedAt))}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`
}

function checkedWithoutFiscalRowsHtml(rows: AnyRecord[]) {
  if (!rows.length) return ''
  const limited = rows.slice(0, 40)
  return `<div style="margin-top:16px">
    <p style="margin:0 0 8px"><b>Checados sem documento fiscal no Zeev</b>${rows.length > limited.length ? ` <span style="color:#6b6257">(primeiros ${limited.length} de ${rows.length})</span>` : ''}</p>
    <table style="border-collapse:collapse;width:100%;font-size:12px">
      <thead>
        <tr>
          <th align="left" style="border-bottom:1px solid #e6d8c5;padding:6px">TR</th>
          <th align="left" style="border-bottom:1px solid #e6d8c5;padding:6px">Alvo</th>
          <th align="left" style="border-bottom:1px solid #e6d8c5;padding:6px">Horario da checagem</th>
        </tr>
      </thead>
      <tbody>
        ${limited.map((row: AnyRecord) => `
          <tr>
            <td style="border-bottom:1px solid #f3eadf;padding:6px">${htmlEscape(row.tr || '')}</td>
            <td style="border-bottom:1px solid #f3eadf;padding:6px">${htmlEscape(row.target || '')}</td>
            <td style="border-bottom:1px solid #f3eadf;padding:6px">${htmlEscape(formatBrDateTime(row.checkedAt))}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`
}

async function runRescueBlockReport(input: AnyRecord = {}) {
  if (!rescueBlockReportEnabled()) return { ok: true, mode: 'rescue-docs-block-report', skipped: true, reason: 'ZEEV_RESCUE_BLOCK_EMAIL desativado' }
  const result = input.result || input.summary || {}
  const run = input.run || {}
  const runId = String(input.runId || input.run_id || run.id || '').trim()
  const runNumber = String(input.runNumber || input.run_number || run.number || '').trim()
  const stateId = runId ? `zeev-rescue-block-email-${runId}` : `zeev-rescue-block-email-${stableHash(JSON.stringify({ result, at: input.finishedAt || input.finished_at || '' }).slice(0, 4000))}`
  const state = await getState(stateId)
  if (state?.last_success_at) return { ok: true, mode: 'rescue-docs-block-report', skipped: true, reason: 'relatorio_de_bloco_ja_enviado', stateId }
  const staleHours = readDocStaleHours(input, Number(env('ZEEV_BACKFILL_STALE_HOURS', '8')), 720)
  const checkedBefore = readDocCheckedBefore(input)
  const audit = await runDocRescueAudit({ staleHours, checkedBefore: checkedBefore ? new Date(checkedBefore).toISOString() : '', recentHours: Number(input.recentHours || input.recent_hours || 24), sampleLimit: 60 })
  let attachments = flattenAttachedTickets(result)
  let attachmentSource = 'bloco'
  if (!attachments.length) {
    attachments = flattenAttachedTickets(audit.recentAttached || {})
    attachmentSource = 'janela_recente_da_auditoria'
  }
  const errors = Array.isArray(result.errors) ? result.errors : []
  const processed = Number(result.processed || 0)
  const filesAttached = Number(result.filesAttached || 0)
  const downloadedDocs = Number(result.downloadedDocs || 0)
  const checkedWithoutFiscal = Number(result.checkedWithoutFiscal || 0)
  const checkedWithoutFiscalTickets = Array.isArray(result.checkedWithoutFiscalTickets) ? result.checkedWithoutFiscalTickets : []
  const rounds = Number(result.rounds || 0)
  const queueTotal = Number(audit?.queue?.total || 0)
  const subject = `Raiz ObraViva - bloco Zeev finalizado: fila ${queueTotal}`
  const runLink = runId ? `https://github.com/eduardofalcaoraiz/raiz-obras/actions/runs/${encodeURIComponent(runId)}` : ''
  const html = `
    <div style="font-family:Arial,sans-serif;color:#173C34;line-height:1.5;background:#fffaf3;padding:20px;border-radius:12px">
      <p style="margin:0 0 6px;color:#a35a00;text-transform:uppercase;letter-spacing:.04em;font-size:12px"><b>Varredura total controlada Zeev</b></p>
      <h2 style="margin:0 0 8px">Bloco online finalizado</h2>
      ${runLink ? `<p style="margin:0 0 12px"><a href="${htmlEscape(runLink)}">Abrir GitHub Actions${runNumber ? ` #${htmlEscape(runNumber)}` : ''}</a></p>` : ''}
      <table style="border-collapse:separate;border-spacing:0 8px;width:100%;font-size:14px">
        <tbody>
          <tr>
            <td style="background:#ffffff;border:1px solid #eadcc9;border-radius:10px;padding:10px"><b>TRs processados no bloco</b><br>${htmlEscape(processed)}</td>
            <td style="background:#ffffff;border:1px solid #eadcc9;border-radius:10px;padding:10px"><b>Docs baixados do Zeev</b><br>${htmlEscape(downloadedDocs)}</td>
            <td style="background:#ffffff;border:1px solid #eadcc9;border-radius:10px;padding:10px"><b>Arquivos anexados</b><br>${htmlEscape(filesAttached)}</td>
          </tr>
          <tr>
            <td style="background:#ffffff;border:1px solid #eadcc9;border-radius:10px;padding:10px"><b>Rodadas</b><br>${htmlEscape(rounds)}</td>
            <td style="background:#ffffff;border:1px solid #eadcc9;border-radius:10px;padding:10px"><b>Fila restante</b><br>${htmlEscape(queueTotal)}</td>
            <td style="background:#ffffff;border:1px solid #eadcc9;border-radius:10px;padding:10px"><b>Checados sem doc fiscal</b><br>${htmlEscape(checkedWithoutFiscal)}</td>
          </tr>
        </tbody>
      </table>
      <p style="margin:10px 0 0"><b>Ainda sem NF fiscal na fila:</b> ${htmlEscape(audit?.queue?.paymentFiscal || 0)} pagamentos. Eles voltarao a ser consultados nas proximas varreduras quando o prazo de rechecagem vencer ou o Zeev atualizar.</p>
      <p style="margin:10px 0 0"><b>Auditoria:</b> ${htmlEscape(audit?.audit?.blocked || 0)} bloqueado(s) por download, ${htmlEscape(audit?.audit?.partial || 0)} parcial(is), ${htmlEscape(audit?.audit?.noDocsInZeev || 0)} sem documento encontrado no Zeev.</p>
      <p style="margin:10px 0 0"><b>Acumulado:</b> ${htmlEscape(audit?.docs?.withAnyDocs || 0)} tickets com algum documento, ${htmlEscape(audit?.docs?.withFiscalDocs || 0)} com NF/DANFE/XML, ${htmlEscape(audit?.docs?.withChargeDocs || 0)} com boleto/fatura e ${htmlEscape(audit?.docs?.withProofDocs || 0)} com comprovante.</p>
      <p style="margin:4px 0 0"><b>Origem da lista de anexos:</b> ${attachmentSource === 'bloco' ? 'resultado direto deste bloco' : 'janela recente da auditoria, pois o bloco nao trouxe lista detalhada'}.</p>
      ${errors.length ? `<p style="margin:10px 0;color:#a33"><b>Alertas/erros no bloco:</b> ${htmlEscape(JSON.stringify(errors.slice(0, 5)).slice(0, 1200))}</p>` : ''}
      ${attachmentRowsHtml(attachments)}
      ${checkedWithoutFiscalRowsHtml(checkedWithoutFiscalTickets)}
    </div>`
  const email = await sendHtmlEmail(subject, html)
  if (email.sent) {
    await saveState(stateId, {
      running: false,
      last_success_at: new Date().toISOString(),
      last_error: null,
      last_run_found: processed,
      last_run_new: filesAttached,
      last_run_updated: queueTotal,
    })
  }
  return {
    ok: Boolean(email.sent),
    mode: 'rescue-docs-block-report',
    sent: Boolean(email.sent),
    provider: email.provider || '',
    reason: email.reason || '',
    stateId,
    queueTotal,
    filesAttached,
    attachmentsListed: attachments.length,
  }
}

function isFinancialZeevRow(row: AnyRecord) {
  const text = normKey([row?.flow_name, row?.request_name, row?.flowName, row?.requestName].filter(Boolean).join(' '))
  return text.includes('financeir') || Number(row?.flow_id || row?.flowId || 0) === 263
}

async function runBackfillDocs(input: AnyRecord = {}) {
  const targetTicketIds = parseTicketIdList(input.ticketIds || input.ticket_ids || input.instanceIds || input.instance_ids || '')
  const limitMax = targetTicketIds.length ? 120 : 80
  const limit = Math.max(1, Math.min(Number(input.limit || 4), limitMax))
  const fileLimit = Math.max(1, Math.min(Number(input.fileLimit || env('ZEEV_BACKFILL_FILE_LIMIT', '12')), 40))
  const refresh = input.refresh !== false
  const staleHours = readDocStaleHours(input, 8, 168)
  const checkedBefore = readDocCheckedBefore(input)
  const targetSet = new Set(targetTicketIds.map((id) => String(id)))
  const fanoutTargets = input.fanoutTargets === true || input.fanout_targets === true
  const includePending = input.includePending !== false
  const includePayments = input.includePayments !== false
  const includeCapex = input.includeCapex !== false
  const scanStrategy = targetTicketIds.length ? 'trs-explicitos-com-fanout' : 'obras-primeiro-capex-registrado-depois-registros-pendentes'
  const out: AnyRecord = { ok: true, mode: 'backfill-docs', scanStrategy, targetTicketIds, staleHours, checkedBefore: checkedBefore ? new Date(checkedBefore).toISOString() : '', scannedPending: 0, scannedPayments: 0, scannedCapex: 0, updatedPending: 0, updatedPayments: 0, updatedCapex: 0, filesAttached: 0, paidUpdated: 0, checkedWithoutFiscal: 0, checkedWithoutFiscalTickets: [], attachedTickets: [], errors: [] }
  const touchedObraIds = new Set<number>()
  let budget = limit

  if (includePending && budget > 0 && targetTicketIds.length) {
    const pendingSelect = 'id,zeev_instance_id,flow_id,flow_name,flow_version,request_name,ticket_link,raw_fields,raw_instance,raw_tasks,itens_json,pagamento_json,campos_extraidos,docs_json,zeev_docs_checked_at,status,start_date_time'
    const pendingFilter = targetTicketIds.length ? `&zeev_instance_id=in.(${targetTicketIds.join(',')})` : '&status=eq.pendente'
    const rows = await rest(`/capex_zeev_solicitacoes?select=${pendingSelect}${pendingFilter}&order=start_date_time.desc&limit=${Math.max(30, limit * 12)}`)
    const candidates = (rows || [])
      .filter((row: AnyRecord) => Number(row.zeev_instance_id) && (!targetSet.size || targetSet.has(String(Number(row.zeev_instance_id)))) && (targetSet.size || docsNeedRescue(row, staleHours, checkedBefore)))
      .sort((a: AnyRecord, b: AnyRecord) => docsCandidateScore(a) - docsCandidateScore(b))
      .slice(0, budget)
    out.scannedPending = candidates.length
    for (const row of candidates) {
      try {
        let ticket = row
        if (refresh) ticket = await loadTicketDocsFromZeev(ticket)
        const current = ticket?.zeev_instance_id && ticket.zeev_instance_id !== row.zeev_instance_id ? ticket : { ...row, ...(ticket || {}) }
        const attach = await attachDocsForTarget('pending', row, current, fileLimit)
        recordAttachedDocs(out, 'pending', row, current, attach)
        recordCheckedWithoutFiscalDoc(out, 'pending', row, current, attach)
        if (targetSet.size && !attach.attached) addDocDebug(out, 'pending', row, current, attach)
        const patch: AnyRecord = { zeev_docs_checked_at: new Date().toISOString() }
        if (attach.attached || JSON.stringify(attach.docs || []) !== JSON.stringify(row.docs_json || [])) patch.docs_json = attach.docs
        if (Object.keys(patch).length) {
          await rest(`/capex_zeev_solicitacoes?id=eq.${Number(row.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) })
          out.updatedPending++
          out.filesAttached += attach.attached
        }
      } catch (error) {
        out.errors.push({ target: 'pending', id: row.id, tr: row.zeev_instance_id, error: error instanceof Error ? error.message : String(error) })
      }
    }
    if (!targetSet.size || !fanoutTargets) budget -= candidates.length
  }

  if (includePayments && budget > 0) {
    const paymentBase = '/pagamentos?select=id,obra_id,ticket_raiz,nf_doc_path,comp_doc_path,docs_json,st,paga_em,venc,obs,zeev_docs_checked_at&ticket_raiz=not.is.null&order=obra_id.asc.nullslast,id.asc'
    const rows = targetTicketIds.length ? await restAll(paymentBase) : await rest(`${paymentBase}&limit=${Math.max(40, limit * 12)}`)
    const candidates = (rows || [])
      .filter((row: AnyRecord) => {
        const refs = paymentTicketRefs(row)
        return refs.length && (!targetSet.size || refs.some((ref) => targetSet.has(ref))) && (targetSet.size || docsNeedRescue(row, staleHours, checkedBefore))
      })
      .sort(comparePaymentDocCandidates)
      .slice(0, budget)
    out.scannedPayments = candidates.length
    const ticketMap = await loadTicketsByIds(candidates.map((row: AnyRecord) => Number(matchedTicketRef(paymentTicketRefs(row), targetSet))))
    for (const row of candidates) {
      try {
        const obraId = Number(row.obra_id || 0)
        if (obraId > 0) touchedObraIds.add(obraId)
        const ticketId = Number(matchedTicketRef(paymentTicketRefs(row), targetSet))
        let ticket = ticketMap.get(ticketId) || { zeev_instance_id: ticketId, ticket_raiz: ticketId }
        if (refresh) ticket = await loadTicketDocsFromZeev({ ...ticket, zeev_instance_id: ticketId, ticket_raiz: ticketId })
        const attach = await attachDocsForTarget('payment', row, ticket, fileLimit)
        recordAttachedDocs(out, 'payment', row, ticket, attach)
        recordCheckedWithoutFiscalDoc(out, 'payment', row, ticket, attach)
        if (targetSet.size && !attach.attached) addDocDebug(out, 'payment', row, ticket, attach)
        const paidDate = paymentDateFromTicket(ticket)
        const patch: AnyRecord = { zeev_docs_checked_at: new Date().toISOString() }
        if (attach.attached || JSON.stringify(attach.docs || []) !== JSON.stringify(row.docs_json || [])) patch.docs_json = attach.docs
        if (!row.nf_doc_path && attach.nfPath) patch.nf_doc_path = attach.nfPath
        if (!row.comp_doc_path && attach.compPath) patch.comp_doc_path = attach.compPath
        if (paidDate && (row.st !== 'PAGO' || row.paga_em !== paidDate)) {
          patch.st = 'PAGO'
          patch.paga_em = paidDate
          out.paidUpdated++
        }
        await rest(`/pagamentos?id=eq.${Number(row.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) })
        out.updatedPayments++
        out.filesAttached += attach.attached
      } catch (error) {
        out.errors.push({ target: 'payment', id: row.id, tr: row.ticket_raiz, error: error instanceof Error ? error.message : String(error) })
      }
    }
    if (!targetSet.size || !fanoutTargets) budget -= candidates.length
  }

  if (includeCapex && budget > 0) {
    const capexBase = '/capex_itens?select=id,referencia,ticket_raiz_instance_id,ticket_raiz_url,ticket_raiz_dados,docs_json,situacao,realizado,zeev_docs_checked_at&order=id.asc'
    const rows = targetTicketIds.length ? await restAll(capexBase) : await rest(`${capexBase}&limit=${Math.max(40, limit * 12)}`)
    const candidates = (rows || [])
      .filter((row: AnyRecord) => {
        const refs = capexTicketRefs(row)
        return refs.length && (!targetSet.size || refs.some((ref) => targetSet.has(ref))) && (targetSet.size || docsNeedRescue(row, staleHours, checkedBefore))
      })
      .sort((a: AnyRecord, b: AnyRecord) => docsCandidateScore(a) - docsCandidateScore(b) || Number(a.id) - Number(b.id))
      .slice(0, budget)
    out.scannedCapex = candidates.length
    const ticketMap = await loadTicketsByIds(candidates.map((row: AnyRecord) => Number(matchedTicketRef(capexTicketRefs(row), targetSet))))
    for (const row of candidates) {
      try {
        const ticketId = Number(matchedTicketRef(capexTicketRefs(row), targetSet))
        let ticket = ticketMap.get(ticketId) || ticketFromCapexDados(row)
        if (refresh) ticket = await loadTicketDocsFromZeev({ ...ticket, zeev_instance_id: ticketId })
        const attach = await attachDocsForTarget('capex', row, ticket, fileLimit)
        recordAttachedDocs(out, 'capex', row, ticket, attach)
        recordCheckedWithoutFiscalDoc(out, 'capex', row, ticket, attach)
        if (targetSet.size && !attach.attached) addDocDebug(out, 'capex', row, ticket, attach)
        const paidDate = paymentDateFromTicket(ticket)
        const patch: AnyRecord = { ticket_raiz_dados: ticketDataPatch(ticket, row.ticket_raiz_dados || {}), zeev_docs_checked_at: new Date().toISOString() }
        if (attach.attached || JSON.stringify(attach.docs || []) !== JSON.stringify(row.docs_json || [])) patch.docs_json = attach.docs
        if (paidDate || ticket.realizado_sugerido === true) {
          patch.situacao = 'Resolvido'
          patch.realizado = true
        } else if (String(ticket.situacao_sugerida || '').toLowerCase() === 'cancelado') {
          patch.situacao = 'Cancelado'
          patch.realizado = false
        }
        await rest(`/capex_itens?id=eq.${Number(row.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) })
        out.updatedCapex++
        out.filesAttached += attach.attached
      } catch (error) {
        out.errors.push({ target: 'capex', id: row.id, tr: row.ticket_raiz_instance_id || row.referencia, error: error instanceof Error ? error.message : String(error) })
      }
    }
    if (!targetSet.size || !fanoutTargets) budget -= candidates.length
  }

  if (includePending && budget > 0 && !targetTicketIds.length) {
    const pendingSelect = 'id,zeev_instance_id,flow_id,flow_name,flow_version,request_name,ticket_link,raw_fields,raw_instance,raw_tasks,itens_json,pagamento_json,campos_extraidos,docs_json,zeev_docs_checked_at,status,start_date_time'
    const rows = await rest(`/capex_zeev_solicitacoes?select=${pendingSelect}&status=eq.pendente&order=start_date_time.asc.nullsfirst,id.asc&limit=${Math.max(30, limit * 12)}`)
    const candidates = (rows || [])
      .filter((row: AnyRecord) => Number(row.zeev_instance_id) && docsNeedRescue(row, staleHours, checkedBefore))
      .sort((a: AnyRecord, b: AnyRecord) => docsCandidateScore(a) - docsCandidateScore(b) || Number(a.id) - Number(b.id))
      .slice(0, budget)
    out.scannedPending = candidates.length
    for (const row of candidates) {
      try {
        let ticket = row
        if (refresh) ticket = await loadTicketDocsFromZeev(ticket)
        const current = ticket?.zeev_instance_id && ticket.zeev_instance_id !== row.zeev_instance_id ? ticket : { ...row, ...(ticket || {}) }
        const attach = await attachDocsForTarget('pending', row, current, fileLimit)
        recordAttachedDocs(out, 'pending', row, current, attach)
        recordCheckedWithoutFiscalDoc(out, 'pending', row, current, attach)
        const patch: AnyRecord = { zeev_docs_checked_at: new Date().toISOString() }
        if (attach.attached || JSON.stringify(attach.docs || []) !== JSON.stringify(row.docs_json || [])) patch.docs_json = attach.docs
        if (Object.keys(patch).length) {
          await rest(`/capex_zeev_solicitacoes?id=eq.${Number(row.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) })
          out.updatedPending++
          out.filesAttached += attach.attached
        }
      } catch (error) {
        out.errors.push({ target: 'pending', id: row.id, tr: row.zeev_instance_id, error: error instanceof Error ? error.message : String(error) })
      }
    }
    budget -= candidates.length
  }

  if (out.errors.length > 25) out.errors = out.errors.slice(0, 25)
  if (touchedObraIds.size) {
    try {
      out.obraDoneEmails = await notifyCompletedObraDocScans([...touchedObraIds], staleHours)
    } catch (error) {
      out.errors.push({ target: 'obra-done-email', error: error instanceof Error ? error.message : String(error) })
    }
  }
  return out
}

async function runDocRescueCandidates(input: AnyRecord = {}) {
  const explicitIds = parseTicketIdList(input.ticketIds || input.ticket_ids || input.instanceIds || input.instance_ids || '')
  const limit = Math.max(1, Math.min(Number(input.limit || input.backfillLimit || input.backfill_limit || 40), 160))
  const staleHours = readDocStaleHours(input, 8, 720)
  const checkedBefore = readDocCheckedBefore(input)
  const includePending = input.includePending !== false
  const includePayments = input.includePayments !== false
  const includeCapex = input.includeCapex !== false
  const ids = new Set<string>()
  const sources: Record<string, number> = { paymentFiscal: 0, payments: 0, capex: 0, financialPending: 0, pending: 0 }
  const add = (value: unknown, source: keyof typeof sources) => {
    const key = String(value || '').replace(/\D+/g, '')
    if (!/^\d{1,7}$/.test(key) || Number(key) <= 0 || ids.has(key) || ids.size >= limit) return
    ids.add(key)
    sources[source]++
  }
  const addRefs = (refs: string[], source: keyof typeof sources) => {
    for (const ref of refs) add(ref, source)
  }
  if (explicitIds.length) {
    for (const id of explicitIds) add(id, 'pending')
    return { ok: true, mode: 'doc-rescue-candidates', strategy: 'trs-explicitos-com-fanout', explicit: true, ticketIds: [...ids].map(Number), sources }
  }

  if (includePayments && ids.size < limit) {
    const rows = await restAll('/pagamentos?select=id,obra_id,ticket_raiz,nf_doc_path,comp_doc_path,docs_json,zeev_docs_checked_at,st,paga_em&ticket_raiz=not.is.null&order=obra_id.asc.nullslast,id.asc')
    for (const row of (rows || []).sort(comparePaymentDocCandidates)) {
      if (ids.size >= limit) break
      if (!docsNeedRescue(row, staleHours, checkedBefore)) continue
      addRefs(paymentTicketRefs(row), 'paymentFiscal')
    }
  }

  if (includeCapex && ids.size < limit) {
    const rows = await restAll('/capex_itens?select=id,referencia,ticket_raiz_instance_id,docs_json,zeev_docs_checked_at&order=zeev_docs_checked_at.asc.nullsfirst,id.asc')
    for (const row of rows || []) {
      if (ids.size >= limit) break
      const refs = capexTicketRefs(row)
      if (!refs.length) continue
      if (!shouldRescueDocs(row, staleHours, 'capex', checkedBefore)) continue
      addRefs(refs, 'capex')
    }
  }
  if (includePayments && ids.size < limit) {
    const rows = await restAll('/pagamentos?select=id,obra_id,ticket_raiz,nf_doc_path,comp_doc_path,docs_json,zeev_docs_checked_at,st,paga_em&ticket_raiz=not.is.null&order=obra_id.asc.nullslast,id.asc')
    for (const row of (rows || []).sort(comparePaymentDocCandidates)) {
      if (ids.size >= limit) break
      const refs = paymentTicketRefs(row)
      if (!refs.length) continue
      if (!shouldRescueDocs(row, staleHours, 'payment', checkedBefore)) continue
      addRefs(refs, 'payments')
    }
  }
  if (includePending && ids.size < limit) {
    const rows = await restAll('/capex_zeev_solicitacoes?select=id,zeev_instance_id,flow_id,flow_name,request_name,docs_json,zeev_docs_checked_at,status&zeev_instance_id=not.is.null&order=start_date_time.asc.nullsfirst,id.asc')
    for (const row of rows || []) {
      if (ids.size >= limit) break
      if (!isFinancialZeevRow(row)) continue
      if (!shouldRescueDocs(row, staleHours, 'pending', checkedBefore)) continue
      add(row.zeev_instance_id, 'financialPending')
    }
  }
  if (includePending && ids.size < limit) {
    const rows = await restAll('/capex_zeev_solicitacoes?select=id,zeev_instance_id,flow_id,flow_name,request_name,docs_json,zeev_docs_checked_at,status&zeev_instance_id=not.is.null&order=start_date_time.asc.nullsfirst,id.asc')
    for (const row of rows || []) {
      if (ids.size >= limit) break
      if (!shouldRescueDocs(row, staleHours, 'pending', checkedBefore)) continue
      add(row.zeev_instance_id, 'pending')
    }
  }
  return { ok: true, mode: 'doc-rescue-candidates', strategy: 'obras-primeiro-capex-registrado-depois-registros-pendentes', ticketIds: [...ids].map(Number), sources, limit, staleHours, checkedBefore: checkedBefore ? new Date(checkedBefore).toISOString() : '' }
}

async function runDocRescueAudit(input: AnyRecord = {}) {
  const staleHours = readDocStaleHours(input, 8, 720)
  const checkedBefore = readDocCheckedBefore(input)
  const sampleLimit = Math.max(10, Math.min(Number(input.sampleLimit || input.sample_limit || 80), 300))
  const recentHours = Math.max(1, Math.min(Number(input.recentHours || input.recent_hours || 24), 168))
  const recentSince = Date.now() - recentHours * 3600 * 1000
  const recentAttached: AnyRecord[] = []
  const recentSeen = new Set<string>()
  const payments = await restAll('/pagamentos?select=id,ticket_raiz,nf_doc_path,comp_doc_path,docs_json,zeev_docs_checked_at,st,paga_em&ticket_raiz=not.is.null&order=id.asc')
  const pending = await restAll('/capex_zeev_solicitacoes?select=id,zeev_instance_id,flow_id,flow_name,request_name,docs_json,zeev_docs_checked_at,status&zeev_instance_id=not.is.null&order=id.asc')
  const capex = await restAll('/capex_itens?select=id,referencia,ticket_raiz_instance_id,docs_json,zeev_docs_checked_at&order=id.asc')

  const all = new Set<string>()
  const paymentIds = new Set<string>()
  const pendingIds = new Set<string>()
  const financialPendingIds = new Set<string>()
  const capexIds = new Set<string>()
  const withAnyDocs = new Set<string>()
  const withFiscalDocs = new Set<string>()
  const withChargeDocs = new Set<string>()
  const withProofDocs = new Set<string>()
  const neverChecked = new Set<string>()
  const checkedFresh = new Set<string>()
  const rescueQueue = new Set<string>()
  const paymentFiscalQueue = new Set<string>()
  const auditStatusCounts: Record<string, number> = {}
  const auditAttention = new Set<string>()
  const auditBlocked = new Set<string>()
  const auditPartial = new Set<string>()
  const auditNoDocs = new Set<string>()
  const addAll = (value: unknown) => {
    const key = ticketDigits(value)
    if (key) all.add(key)
    return key
  }
  const markDocState = (key: string, row: AnyRecord) => {
    if (!key) return
    if (normalizeStoredDocs(row).length || row?.nf_doc_path || row?.comp_doc_path) withAnyDocs.add(key)
    if (hasStoredFiscalDoc(row)) withFiscalDocs.add(key)
    if (hasStoredChargeDoc(row)) withChargeDocs.add(key)
    if (hasStoredProofDoc(row)) withProofDocs.add(key)
    if (!row?.zeev_docs_checked_at) neverChecked.add(key)
    else if (!docsNeedRescue(row, staleHours, checkedBefore)) checkedFresh.add(key)
    const audit = latestZeevDocAudit(row)
    if (audit) {
      const status = String(audit.status || 'sem_status').toLowerCase()
      auditStatusCounts[status] = (auditStatusCounts[status] || 0) + 1
      if (status === 'sem_documento_no_zeev') auditNoDocs.add(key)
      if (status === 'bloqueado_download' || status === 'erro_download') auditBlocked.add(key)
      if (status === 'parcial_limite') auditPartial.add(key)
      if (auditStatusNeedsAttention(status)) auditAttention.add(key)
    }
  }
  const collectRecentAttached = (key: string, target: string, row: AnyRecord) => {
    if (!key || recentAttached.length >= 120) return
    const recentDocMap = new Map<string, AnyRecord>()
    for (const doc of normalizeStoredDocs(row)) {
      const pathTs = String(doc?.storagePath || doc?.path || '').match(/\/(?:nf|documento|boleto|fatura|comprovante)_(\d{12,})_/i)
      const ts = new Date(String(doc?.attachedAt || '')).getTime() || Number(pathTs?.[1] || 0)
      if (!ts || Number.isNaN(ts) || ts < recentSince) continue
      const name = String(doc?.name || '').trim()
      const keyName = normKey(name || doc?.storagePath || doc?.path || '')
      if (!keyName) continue
      const current = recentDocMap.get(keyName)
      const item = {
        name,
        kind: fiscalDocKind(doc),
        storagePath: doc?.storagePath || doc?.path || '',
        attachedAt: doc?.attachedAt || (ts ? new Date(ts).toISOString() : ''),
        _ts: ts,
      }
      if (!current || Number(item._ts || 0) > Number(current._ts || 0)) recentDocMap.set(keyName, item)
    }
    const attachments = [...recentDocMap.values()]
      .sort((a, b) => Number(b._ts || 0) - Number(a._ts || 0))
      .slice(0, 12)
      .map((doc: AnyRecord) => ({
        name: doc.name || '',
        kind: doc.kind || '',
        storagePath: doc.storagePath || '',
        attachedAt: doc.attachedAt || '',
      }))
    if (!attachments.length) return
    const invoiceDocs = attachments.filter((doc: AnyRecord) => isInvoiceDocKind(doc.kind))
    const chargeDocs = attachments.filter((doc: AnyRecord) => isChargeDocKind(doc.kind))
    const proofDocs = attachments.filter((doc: AnyRecord) => isProofDocKind(doc.kind))
    const seenKey = `${target}|${row?.id}|${key}|${attachments.map((doc) => `${doc.storagePath}|${doc.attachedAt}`).join(',')}`
    if (recentSeen.has(seenKey)) return
    recentSeen.add(seenKey)
    recentAttached.push({ tr: Number(key), target, rowId: row?.id || null, attachments, invoiceDocs, chargeDocs, proofDocs, fiscalDocs: invoiceDocs })
  }

  for (const row of payments || []) {
    const keys = paymentTicketRefs(row)
    if (!keys.length) continue
    for (const key of keys) {
      addAll(key)
      paymentIds.add(key)
      markDocState(key, row)
      collectRecentAttached(key, 'payment', row)
      if (shouldRescueDocs(row, staleHours, 'payment', checkedBefore)) {
        rescueQueue.add(key)
        if (!hasStoredFiscalDoc(row)) paymentFiscalQueue.add(key)
      }
    }
  }
  for (const row of pending || []) {
    const key = addAll(row.zeev_instance_id)
    if (!key) continue
    pendingIds.add(key)
    if (isFinancialZeevRow(row)) financialPendingIds.add(key)
    markDocState(key, row)
    collectRecentAttached(key, 'pending', row)
    if (shouldRescueDocs(row, staleHours, 'pending', checkedBefore)) rescueQueue.add(key)
  }
  for (const row of capex || []) {
    const keys = capexTicketRefs(row)
    if (!keys.length) continue
    for (const key of keys) {
      addAll(key)
      capexIds.add(key)
      markDocState(key, row)
      collectRecentAttached(key, 'capex', row)
      if (shouldRescueDocs(row, staleHours, 'capex', checkedBefore)) rescueQueue.add(key)
    }
  }

  return {
    ok: true,
    mode: 'doc-rescue-audit',
    staleHours,
    checkedBefore: checkedBefore ? new Date(checkedBefore).toISOString() : '',
    rows: { payments: payments.length, pending: pending.length, capex: capex.length },
    uniqueTickets: all.size,
    uniqueBySource: { payments: paymentIds.size, pending: pendingIds.size, financialPending: financialPendingIds.size, capex: capexIds.size },
    docs: { withAnyDocs: withAnyDocs.size, withFiscalDocs: withFiscalDocs.size, withChargeDocs: withChargeDocs.size, withProofDocs: withProofDocs.size, withoutAnyDocs: Math.max(0, all.size - withAnyDocs.size), withoutFiscalDocs: Math.max(0, all.size - withFiscalDocs.size) },
    checked: { neverChecked: neverChecked.size, fresh: checkedFresh.size, staleOrMissing: rescueQueue.size },
    audit: {
      statusCounts: auditStatusCounts,
      attention: auditAttention.size,
      blocked: auditBlocked.size,
      partial: auditPartial.size,
      noDocsInZeev: auditNoDocs.size,
      attentionSample: [...auditAttention].slice(0, sampleLimit).map(Number),
      blockedSample: [...auditBlocked].slice(0, sampleLimit).map(Number),
      partialSample: [...auditPartial].slice(0, sampleLimit).map(Number),
      noDocsSample: [...auditNoDocs].slice(0, sampleLimit).map(Number),
    },
    queue: { total: rescueQueue.size, paymentFiscal: paymentFiscalQueue.size, blocked: auditBlocked.size, partial: auditPartial.size, attention: auditAttention.size, strategy: 'obras-primeiro-capex-registrado-depois-registros-pendentes', sample: [...rescueQueue].slice(0, sampleLimit).map(Number) },
    recentAttached: { hours: recentHours, total: recentAttached.length, tickets: recentAttached.slice(0, sampleLimit) },
  }
}

function docRescueDetailRow(target: string, row: AnyRecord, tr: unknown) {
  const docs = normalizeStoredDocs(row)
  const audit = latestZeevDocAudit(row)
  const counts = countStoredDocsByKind(docs)
  return {
    target,
    id: row?.id || null,
    tr: Number(ticketDigits(tr) || 0) || ticketDigits(tr),
    checkedAt: row?.zeev_docs_checked_at || '',
    docs: counts,
    audit: audit ? {
      status: audit.status || '',
      checkedAt: audit.checkedAt || '',
      candidateCount: audit.candidateCount || 0,
      rawCandidateCount: audit.rawCandidateCount || audit.candidateCount || 0,
      attemptedCandidateCount: audit.attemptedCandidateCount || 0,
      unattemptedCandidateCount: audit.unattemptedCandidateCount || 0,
      attachedCount: audit.attachedCount || 0,
      storedDocCount: audit.storedDocCount || 0,
      storedFiscalCount: audit.storedFiscalCount || 0,
      storedChargeCount: audit.storedChargeCount || 0,
      storedProofCount: audit.storedProofCount || 0,
      skippedCount: audit.skippedCount || 0,
      dedupedCount: audit.dedupedCount || 0,
      ignoredCount: audit.ignoredCount || 0,
      requiredKindsCovered: Boolean(audit.requiredKindsCovered),
      skipped: Array.isArray(audit.skipped) ? audit.skipped.slice(0, 5) : [],
      deduped: Array.isArray(audit.deduped) ? audit.deduped.slice(0, 5) : [],
      ignored: Array.isArray(audit.ignored) ? audit.ignored.slice(0, 5) : [],
    } : null,
    files: docs.slice(0, 20).map((doc: AnyRecord) => ({
      name: doc.name || '',
      kind: fiscalDocKind(doc),
      path: doc.storagePath || doc.path || '',
      sha256: doc.sha256 || '',
      attachedAt: doc.attachedAt || '',
    })),
  }
}

async function runDocRescueDetail(input: AnyRecord = {}) {
  const ticketIds = parseTicketIdList(input.ticketIds || input.ticket_ids || input.instanceIds || input.instance_ids || input.ticketId || input.ticket_id || '')
  if (!ticketIds.length) throw new Error('Informe ao menos um TR para detalhar auditoria.')
  const idSet = new Set(ticketIds.map((id) => String(id)))
  const out: AnyRecord = { ok: true, mode: 'doc-rescue-detail', ticketIds, rows: [] }
  const pending = await rest(`/capex_zeev_solicitacoes?select=id,zeev_instance_id,flow_id,flow_name,request_name,docs_json,zeev_docs_checked_at,status&zeev_instance_id=in.(${ticketIds.join(',')})&limit=${Math.max(20, ticketIds.length * 4)}`)
  for (const row of pending || []) out.rows.push(docRescueDetailRow('pending', row, row.zeev_instance_id))
  const payments = await restAll('/pagamentos?select=id,obra_id,ticket_raiz,nf_doc_path,comp_doc_path,docs_json,zeev_docs_checked_at,st,paga_em&ticket_raiz=not.is.null&order=id.asc')
  for (const row of payments || []) {
    const refs = paymentTicketRefs(row)
    if (refs.some((ref) => idSet.has(ref))) out.rows.push(docRescueDetailRow('payment', row, matchedTicketRef(refs, idSet) || refs[0]))
  }
  const capex = await restAll('/capex_itens?select=id,referencia,ticket_raiz_instance_id,docs_json,zeev_docs_checked_at,situacao,realizado&order=id.asc')
  for (const row of capex || []) {
    const refs = capexTicketRefs(row)
    if (refs.some((ref) => idSet.has(ref))) out.rows.push(docRescueDetailRow('capex', row, matchedTicketRef(refs, idSet) || refs[0]))
  }
  return out
}

function paymentIsOverdue(row: AnyRecord) {
  if (String(row?.st || '').toUpperCase() === 'PAGO') return false
  const venc = dateOnly(row?.venc)
  if (!venc) return false
  return venc < new Date().toISOString().slice(0, 10)
}

async function runRefreshPaymentStatuses(input: AnyRecord = {}) {
  const limit = Math.max(1, Math.min(Number(input.limit || input.backfillLimit || input.backfill_limit || 150), 350))
  const fileLimit = Math.max(1, Math.min(Number(input.fileLimit || input.file_limit || env('ZEEV_BACKFILL_FILE_LIMIT', '12')), 40))
  const staleHours = readDocStaleHours(input, 8, 168)
  const targetTicketIds = parseTicketIdList(input.ticketIds || input.ticket_ids || input.instanceIds || input.instance_ids || '')
  const targetSet = new Set(targetTicketIds.map((id) => String(id)))
  const onlyOverdue = input.onlyOverdue !== false && input.only_overdue !== false && !targetTicketIds.length
  const out: AnyRecord = { ok: true, mode: 'refresh-payment-statuses', requested: targetTicketIds, staleHours, scannedPayments: 0, updatedPaid: 0, updatedDueDate: 0, filesAttached: 0, errors: [], updated: [], unchanged: [], sources: { storedReport: 0, zeevInstance: 0, failedInstance: 0 } }

  const paymentFilter = targetTicketIds.length ? `ticket_raiz=in.(${targetTicketIds.join(',')})` : 'ticket_raiz=not.is.null'
  const rows = await restAll(`/pagamentos?select=id,obra_id,ticket_raiz,nf_doc_path,comp_doc_path,docs_json,st,paga_em,venc,obs,zeev_docs_checked_at&${paymentFilter}&order=id.asc`, 1000)
  const candidates = (rows || [])
    .filter((row: AnyRecord) => ticketDigits(row.ticket_raiz) && (!targetSet.size || targetSet.has(ticketDigits(row.ticket_raiz))))
    .filter((row: AnyRecord) => !onlyOverdue || paymentIsOverdue(row))
    .filter((row: AnyRecord) => targetSet.size || String(row.st || '').toUpperCase() !== 'PAGO')
    .filter((row: AnyRecord) => targetSet.size || docsCheckIsStale(row, staleHours))
    .sort((a: AnyRecord, b: AnyRecord) => Number(paymentIsOverdue(b)) - Number(paymentIsOverdue(a)) || docsCandidateScore(a) - docsCandidateScore(b) || String(a.venc || '').localeCompare(String(b.venc || '')) || Number(a.id) - Number(b.id))
    .slice(0, limit)
  out.scannedPayments = candidates.length
  const ticketMap = await loadTicketsByIds(candidates.map((row: AnyRecord) => Number(ticketDigits(row.ticket_raiz))))

  for (const row of candidates) {
    const tr = Number(ticketDigits(row.ticket_raiz))
    try {
      const ticket = await loadPaymentTicketForRefresh(row, ticketMap.get(tr))
      const source = String(ticket?.__zeev_load_source || ticket?.raw_instance?.__zeev_load_source || (ticket?.__zeev_load_error || ticket?.raw_instance?.__zeev_load_error ? 'failed-instance' : 'zeev-instance'))
      if (source === 'stored-report') out.sources.storedReport++
      else if (source === 'failed-instance') out.sources.failedInstance++
      else out.sources.zeevInstance++
      const attach = await attachDocsForTarget('payment', row, ticket, fileLimit)
      const paidDate = paymentDateFromTicket(ticket)
      const dueDate = dueDateFromTicket(ticket)
      const lifecycleStatus = paymentLifecycleStatusFromTicket(ticket)
      const patch: AnyRecord = { zeev_docs_checked_at: new Date().toISOString() }
      if (attach.attached || JSON.stringify(attach.docs || []) !== JSON.stringify(row.docs_json || [])) patch.docs_json = attach.docs || []
      if (!row.nf_doc_path && attach.nfPath) patch.nf_doc_path = attach.nfPath
      if (!row.comp_doc_path && attach.compPath) patch.comp_doc_path = attach.compPath
      if (paidDate) {
        patch.st = 'PAGO'
        patch.paga_em = paidDate
        out.updatedPaid++
      } else if (lifecycleStatus) {
        patch.st = lifecycleStatus
        patch.paga_em = ''
      } else if (dueDate && dueDate !== row.venc) {
        patch.venc = dueDate
        patch.st = 'PENDENTE'
        out.updatedDueDate++
      }
      const changed = Object.keys(patch).filter((key) => key !== 'zeev_docs_checked_at').length > 0
      await rest(`/pagamentos?id=eq.${Number(row.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) })
      out.filesAttached += Number(attach.attached || 0)
      const summary = { tr, pagamento_id: Number(row.id), obra_id: Number(row.obra_id), before: { st: row.st, venc: row.venc, paga_em: row.paga_em || '' }, after: { st: patch.st || row.st, venc: patch.venc || row.venc, paga_em: patch.paga_em || row.paga_em || '' }, docsAttached: Number(attach.attached || 0) }
      if (changed) out.updated.push(summary)
      else if (out.unchanged.length < 30) out.unchanged.push({ tr, pagamento_id: Number(row.id), reason: 'sem_evidencia_nova_no_zeev', debug: paymentStatusDebug(ticket) })
    } catch (error) {
      out.errors.push({ tr, pagamento_id: Number(row.id), error: error instanceof Error ? error.message : String(error) })
    }
  }
  if (out.errors.length > 30) out.errors = out.errors.slice(0, 30)
  if (out.updated.length > 100) out.updated = out.updated.slice(0, 100)
  return out
}

function ticketFieldMap(ticket: AnyRecord) {
  return fieldMap(Array.isArray(ticket?.raw_fields) ? ticket.raw_fields : Array.isArray(ticket?.rawFields) ? ticket.rawFields : [])
}

function ticketFirstField(ticket: AnyRecord, names: string[]) {
  return firstField(ticketFieldMap(ticket), names)
}

function ticketValueForPayment(ticket: AnyRecord) {
  const direct = Number(ticket?.valor_final || ticket?.valor || ticket?.pagamento_json?.valor_total || 0)
  if (Number.isFinite(direct) && direct > 0) return direct
  return pickTicketValue(ticketFieldMap(ticket), Array.isArray(ticket?.itens_json) ? ticket.itens_json : [], isFinanceiro(ticket))
}

function ticketFornecedorForPayment(ticket: AnyRecord) {
  return ticketFirstField(ticket, ['fornecedor', 'nomeFornecedor', 'razaoSocial', 'razao social', 'favorecido', 'beneficiario', 'cnpjFornecedor', 'prestador', 'empresa'])
    || ticket?.requester_name
    || `Ticket Raiz ${ticket?.zeev_instance_id || ''}`.trim()
}

function ticketDescriptionForPayment(ticket: AnyRecord) {
  const fmap = ticketFieldMap(ticket)
  const items = Array.isArray(ticket?.itens_json) ? ticket.itens_json : []
  return cleanSummaryText(ticket?.pedido || '')
    || cleanSummaryText(ticketDescription(fmap, items, isFinanceiro(ticket), isCompra(ticket)))
    || cleanSummaryText(ticketFirstField(ticket, [...FINANCE_DESCRIPTION_FIELDS, ...PURCHASE_JUSTIFICATION_FIELDS, ...PURCHASE_SERVICE_DESCRIPTION_FIELDS, ...PURCHASE_ITEM_DESCRIPTION_FIELDS, 'descricao', 'pedido', 'solicitacao', 'objeto', 'resumo']))
    || ticket?.request_name
    || `Ticket Raiz ${ticket?.zeev_instance_id || ''}`.trim()
}

function defaultPagadorForObra(obra: AnyRecord) {
  const refs = Array.isArray(obra?.unidades_obra) ? obra.unidades_obra : []
  const principal = refs.find((u: AnyRecord) => u?.principal) || refs[0]
  return String(principal?.nome || obra?.nome || '').trim()
}

function fiscalTypeForTicket(ticket: AnyRecord, storedDocs: AnyRecord[]) {
  const candidates = [...storedDocs, ...zeevDocsFromTicket(ticket)]
  const text = normKey(candidates.map((doc) => [doc?.name, doc?.source, doc?.type, doc?.kind].filter(Boolean).join(' ')).join(' '))
  if (/\d{44}/.test(candidates.map((doc) => [doc?.name, doc?.source, doc?.url, doc?.storagePath].filter(Boolean).join(' ')).join(' '))) return 'NF-e'
  if (text.includes('nfe') || text.includes('danfe') || text.includes('xml')) return 'NF-e'
  if (text.includes('nfse') || text.includes('nfs e') || text.includes('nota') || text.includes('nf')) return 'NFS-e'
  if (text.includes('boleto')) return 'Boleto'
  if (text.includes('fatura')) return 'Fatura'
  if (text.includes('recibo')) return 'Recibo'
  if (candidates.length) return 'Documento'
  return 'Sem nota'
}

function paymentPayloadFromTicket(ticket: AnyRecord, obra: AnyRecord, escopo: string) {
  const storedDocs = normalizeStoredDocs(ticket)
  const invoiceDocs = storedDocs.filter((doc) => isInvoiceDocKind(fiscalDocKind(doc)))
  const comprovantes = storedDocs.filter((doc) => isProofDocKind(fiscalDocKind(doc)))
  const nfTipo = fiscalTypeForTicket(ticket, storedDocs)
  const nfNum = ticket?.pagamento_json?.nota_fiscal
    || ticketFirstField(ticket, ['notaFiscal', 'numeroNF', 'numeroNotaFiscal', 'numero da nota fiscal', 'nf', 'fatura', 'boleto'])
    || ''
  const venc = dateOnly(ticket?.pagamento_json?.previsao_pagamento || ticket?.pagamento_json?.dataVencimento)
    || dateOnly(ticketFirstField(ticket, ['previsaoPagamento', 'dataDeVencimento', 'dataVencimento', 'dataPagamento']))
  const paidDate = paymentDateFromTicket(ticket)
  const lifecycleStatus = paymentLifecycleStatusFromTicket(ticket)
  const link = String(ticket?.ticket_link || '').trim()
  return {
    obra_id: Number(obra.id),
    ben: ticketFornecedorForPayment(ticket),
    v: ticketValueForPayment(ticket),
    ref: ticketDescriptionForPayment(ticket),
    nf_num: String(nfNum || '').trim(),
    cat: 'outros',
    sub: 0,
    pagn: defaultPagadorForObra(obra),
    st: paidDate ? 'PAGO' : lifecycleStatus || 'PENDENTE',
    venc: venc || paidDate || '',
    nf_tipo: nfTipo,
    comp: '',
    nf_doc_path: invoiceDocs[0]?.storagePath || '',
    comp_doc_path: comprovantes[0]?.storagePath || '',
    docs_json: storedDocs,
    emissao: '',
    paga_em: paidDate || '',
    escopo_fin: escopo === 'extra' ? 'extra' : 'obra',
    contrato_seq: null,
    tipo_custo: 'outros',
    mat_tipo: '',
    mat_qtd: null,
    mat_unidade: '',
    chave: ticket?.pagamento_json?.chave_acesso || ticketFirstField(ticket, ['chaveAcesso', 'chave de acesso']) || '',
    obs: link ? `Ticket Raiz: ${link}` : '',
    pag_forma: ticket?.pagamento_json?.forma || 'A_VISTA',
    parcelas: [],
    itens_pag: Array.isArray(ticket?.itens_json) ? ticket.itens_json : [],
    construtora_seq: null,
    ticket_raiz: String(ticket?.zeev_instance_id || ''),
  }
}

function findTargetObra(obras: AnyRecord[], name: string) {
  const key = normKey(name)
  if (!key) return null
  const exact = obras.filter((obra) => normKey(obra?.nome) === key)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) throw new Error(`Mais de uma obra encontrada com o nome "${name}".`)
  const partial = obras.filter((obra) => {
    const n = normKey(obra?.nome)
    return n && (n.includes(key) || key.includes(n))
  })
  if (partial.length === 1) return partial[0]
  if (partial.length > 1) throw new Error(`Obra "${name}" ambigua: ${partial.map((o) => o.nome).join(', ')}.`)
  return null
}

function findTargetCapexUnit(unidades: AnyRecord[], name: string) {
  const key = normKey(name)
  if (!key) return null
  const exact = unidades.filter((unit) => normKey(unit?.nome) === key)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) throw new Error(`Mais de uma unidade encontrada com o nome "${name}".`)
  const partial = unidades.filter((unit) => {
    const n = normKey(unit?.nome)
    return n && (n.includes(key) || key.includes(n))
  })
  if (partial.length === 1) return partial[0]
  if (partial.length > 1) throw new Error(`Unidade "${name}" ambigua: ${partial.map((unit) => unit.nome).join(', ')}.`)
  return null
}

const CAPEX_CATEGORY_RULES_EDGE: [string, string[]][] = [
  ['capex_mobiliario', ['cadeira', 'mesa', 'armario', 'estante', 'bancada', 'sofa', 'marcenaria', 'movel', 'mobiliario', 'locker']],
  ['capex_ti', ['computador', 'notebook', 'monitor', 'impressora', 'tablet', 'switch', 'roteador', 'wifi', 'rede logica', 'projetor', 'tv', 'audio', 'nobreak', 'software']],
  ['capex_material_manutencao', ['chapa', 'parafuso', 'bucha', 'cola', 'silicone', 'cimento', 'areia', 'madeira', 'tubo', 'material de manutencao', 'ferragem', 'ferramenta', 'calha']],
  ['capex_servicos', ['mao de obra', 'servico', 'servicos', 'laudo', 'vistoria', 'projeto', 'levantamento', 'frete', 'transporte', 'locacao', 'manutencao', 'retirada', 'montagem']],
  ['capex_pintura', ['pintura', 'tinta', 'grafiato', 'revestimento', 'piso', 'porcelanato', 'ceramica', 'azulejo', 'forro', 'drywall', 'gesso']],
  ['capex_obras_civis', ['obra', 'reforma', 'construcao', 'demolicao', 'alvenaria', 'concreto', 'estrutura', 'cobertura', 'telhado', 'escada', 'rampa', 'fachada', 'ampliacao']],
  ['capex_hidraulica', ['hidraulica', 'vazamento', 'infiltracao', 'caixa d agua', 'bomba d agua', 'ralo', 'esgoto', 'vaso sanitario', 'torneira', 'pia', 'banheiro', 'bebedouro']],
  ['capex_climatizacao', ['ar condicionado', 'split', 'climatizacao', 'ventilador', 'exaustao', 'duto', 'evaporadora', 'condensadora']],
  ['capex_eletrica', ['eletrica', 'eletrico', 'iluminacao', 'luminaria', 'lampada', 'led', 'tomada', 'disjuntor', 'quadro eletrico', 'eletroduto', 'energia']],
  ['capex_seguranca', ['cftv', 'camera', 'alarme', 'controle de acesso', 'catraca', 'fechadura', 'interfone', 'grade', 'portao', 'concertina', 'extintor', 'incendio']],
  ['capex_comunicacao', ['comunicacao visual', 'sinalizacao', 'placa', 'adesivo', 'letreiro', 'totem', 'banner', 'lona', 'plotagem', 'logo']],
  ['capex_playground', ['playground', 'parquinho', 'brinquedo', 'grama', 'jardim', 'quadra', 'rede de protecao', 'tatame', 'area externa', 'patio']],
  ['capex_cozinha', ['cozinha', 'copa', 'geladeira', 'freezer', 'microondas', 'fogao', 'forno', 'refeitorio', 'coifa']],
  ['capex_pedagogico', ['biblioteca', 'livro', 'laboratorio', 'microscopio', 'brinquedoteca', 'material pedagogico', 'lousa', 'quadro branco', 'instrumento musical']],
  ['capex_ambientes', ['recepcao', 'auditorio', 'area de convivencia', 'sala de aula', 'secretaria', 'almoxarifado', 'hall', 'novo acesso']],
]

function capexNormTextEdge(value: unknown) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function capexTextHasEdge(text: string, term: string) {
  return ` ${text} `.includes(` ${capexNormTextEdge(term)} `)
}

function capexCategoryFromTicket(ticket: AnyRecord) {
  const direct = String(ticket?.categoria_capex || ticketFirstField(ticket, ['categoria_capex', 'categoriaCapex']) || '').trim()
  if (direct.startsWith('capex_')) return direct
  const desc = capexNormTextEdge([
    ticket?.pedido,
    ticketDescriptionForPayment(ticket),
    direct,
    JSON.stringify(ticket?.itens_json || []),
    JSON.stringify(ticket?.campos_extraidos || {}),
  ].filter(Boolean).join(' '))
  const meta = capexNormTextEdge([ticket?.setor, ticket?.fonte, flowName(ticket), ticket?.flow_name].filter(Boolean).join(' '))
  const hits: { id: string; score: number; idx: number }[] = []
  CAPEX_CATEGORY_RULES_EDGE.forEach(([id, terms], idx) => {
    const score = terms.reduce((total, term) => total + (capexTextHasEdge(desc, term) ? 1 : 0), 0)
    if (score) hits.push({ id, score, idx })
  })
  if (!hits.length) {
    if (capexTextHasEdge(meta, 'ti')) return 'capex_ti'
    if (capexTextHasEdge(meta, 'manutencao')) return 'capex_material_manutencao'
    return 'capex_outros'
  }
  hits.sort((a, b) => b.score - a.score || a.idx - b.idx)
  return hits[0]?.id || 'capex_outros'
}

function capexStatusFromTicket(ticket: AnyRecord) {
  const raw = String(ticket?.situacao_sugerida || '').trim()
  if (['Resolvido', 'Em Andamento', 'Cancelado'].includes(raw)) return { situacao: raw, realizado: raw === 'Resolvido' }
  const tasks = Array.isArray(ticket?.raw_tasks) ? ticket.raw_tasks : Array.isArray(ticket?.raw_instance?.instanceTasks) ? ticket.raw_instance.instanceTasks : []
  const status = suggestedCapexStatus(ticket?.raw_instance || ticket, valueIsFinalForPurchase(ticket?.raw_instance || ticket, tasks))
  return status
}

function capexPayloadFromTicket(ticket: AnyRecord, unit: AnyRecord, ano: number) {
  const ticketId = Number(ticket?.zeev_instance_id || 0)
  const pedido = ticketDescriptionForPayment(ticket) || `Ticket Raiz ${ticketId}`
  const value = ticketValueForPayment(ticket)
  const status = capexStatusFromTicket(ticket)
  const dados = ticketDataPatch(ticket, {})
  dados.solicitante = {
    nome: ticket?.requester_name || ticket?.raw_instance?.requester?.name || '',
    email: ticket?.requester_email || ticket?.raw_instance?.requester?.email || '',
    equipe: ticket?.requester_team || ticket?.raw_instance?.requester?.team?.name || '',
  }
  return {
    ano,
    fonte: '',
    unidade: unit.nome,
    unidades_json: [],
    marca: unit.marca || '',
    pedido,
    referencia: String(ticketId || ''),
    setor: ticket?.setor || (isFinanceiro(ticket) ? 'FINANCEIRO' : 'COMPRAS'),
    categoria_capex: capexCategoryFromTicket(ticket),
    situacao: status.situacao,
    orcamento: value || 0,
    aprovado: true,
    realizado: Boolean(status.realizado),
    observacoes: '',
    ticket_raiz_url: ticket?.ticket_link || '',
    ticket_raiz_instance_id: ticketId || null,
    origem: 'ZEEV',
    ticket_raiz_dados: dados,
    docs_json: normalizeStoredDocs(ticket),
  }
}

async function registerCapexItems(input: AnyRecord = {}) {
  const ticketIds = parseTicketIdList(input.ticketIds || input.ticket_ids || input.instanceIds || input.instance_ids || '')
  const unidadeName = String(input.unidadeName || input.targetUnidade || input.target_unidade || input.unidade || input.escola || input.school || '').trim()
  const ano = Number(input.ano || input.targetAno || input.target_ano || input.year || new Date().getFullYear()) || new Date().getFullYear()
  const requestedFileLimit = input.fileLimit ?? input.file_limit ?? 2
  const fileLimit = Math.max(0, Math.min(Number(requestedFileLimit), 40))
  if (!ticketIds.length) throw new Error('Nenhum TR informado para registrar no CAPEX.')
  if (!unidadeName) throw new Error('Informe a unidade destino para registrar no CAPEX.')

  const unidades = await restAll('/unidades?select=id,nome,marca')
  const unit = findTargetCapexUnit(unidades, unidadeName)
  if (!unit) throw new Error(`Unidade destino nao encontrada: ${unidadeName}`)

  const existingCapexRows = await rest(`/capex_itens?select=id,ano,unidade,referencia,ticket_raiz_instance_id&or=(referencia.in.(${ticketIds.join(',')}),ticket_raiz_instance_id.in.(${ticketIds.join(',')}))`)
  const existingPaymentRows = await rest(`/pagamentos?select=id,obra_id,ticket_raiz&ticket_raiz=in.(${ticketIds.join(',')})`)
  const existingCapex = new Map<string, AnyRecord[]>()
  for (const row of existingCapexRows || []) {
    const key = ticketDigits(row.ticket_raiz_instance_id || row.referencia)
    if (!key) continue
    const rows = existingCapex.get(key) || []
    rows.push(row)
    existingCapex.set(key, rows)
  }
  const existingPayments = new Map<string, AnyRecord[]>()
  for (const row of existingPaymentRows || []) {
    const key = ticketDigits(row.ticket_raiz)
    if (!key) continue
    const rows = existingPayments.get(key) || []
    rows.push(row)
    existingPayments.set(key, rows)
  }

  const dbTickets = await loadTicketsByIds(ticketIds)
  const out: AnyRecord = { ok: true, mode: 'register-capex-items', ano, unidade: { id: unit.id, nome: unit.nome, marca: unit.marca }, requested: ticketIds, inserted: [], skipped: [], errors: [], docsAttached: 0 }
  for (const id of ticketIds) {
    try {
      const key = ticketDigits(id)
      const capexRows = existingCapex.get(key) || []
      const paymentRows = existingPayments.get(key) || []
      if (capexRows.length) {
        out.skipped.push({ tr: id, reason: 'ja_existe_em_capex', ids: capexRows.map((row) => row.id) })
        continue
      }
      if (paymentRows.length) {
        out.skipped.push({ tr: id, reason: 'ja_existe_em_pagamentos', ids: paymentRows.map((row) => row.id) })
        continue
      }

      const storedTicket = dbTickets.get(id)
      const hasStoredTicketData = Boolean(
        storedTicket && (
          storedTicket.pedido ||
          storedTicket.valor ||
          storedTicket.valor_final ||
          storedTicket.ticket_link ||
          Object.keys(storedTicket.campos_extraidos || {}).length ||
          (Array.isArray(storedTicket.raw_fields) && storedTicket.raw_fields.length) ||
          (Array.isArray(storedTicket.itens_json) && storedTicket.itens_json.length)
        ),
      )
      let ticket = hasStoredTicketData ? storedTicket : (storedTicket || { zeev_instance_id: id })
      if (!hasStoredTicketData) ticket = await loadGenericTicketFromZeev(ticket)
      const ticketId = Number(ticket?.zeev_instance_id || id)
      if (!ticketId) {
        out.skipped.push({ tr: id, reason: 'ticket_nao_encontrado' })
        continue
      }
      const payload = capexPayloadFromTicket({ ...ticket, zeev_instance_id: ticketId }, unit, ano)
      if (!payload.pedido || payload.pedido === `Ticket Raiz ${ticketId}`) out.errors.push({ tr: ticketId, warning: 'descricao_nao_encontrada_no_zeev' })
      if (!payload.orcamento) out.errors.push({ tr: ticketId, warning: 'valor_nao_encontrado_no_zeev' })
      const savedRows = await rest('/capex_itens', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([payload]) })
      const saved = Array.isArray(savedRows) ? savedRows[0] : savedRows
      if (!saved?.id) throw new Error('Supabase nao retornou o item CAPEX salvo.')

      let attach: AnyRecord = { docs: saved.docs_json || [], attached: 0 }
      if (fileLimit > 0) {
        try {
          attach = await attachDocsForTarget('capex', saved, { ...ticket, zeev_instance_id: ticketId }, fileLimit)
        } catch (error) {
          out.errors.push({ tr: ticketId, step: 'anexos', error: error instanceof Error ? error.message : String(error) })
        }
      }
      const patch: AnyRecord = { zeev_docs_checked_at: new Date().toISOString() }
      if (JSON.stringify(attach.docs || []) !== JSON.stringify(saved.docs_json || [])) patch.docs_json = attach.docs || []
      await rest(`/capex_itens?id=eq.${Number(saved.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) })
      out.docsAttached += Number(attach.attached || 0)

      await rest(`/capex_zeev_solicitacoes?zeev_instance_id=eq.${ticketId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'aprovado',
          capex_item_id: Number(saved.id),
          aprovado_em: new Date().toISOString(),
          aprovado_por: 'capex_lote',
        }),
      })

      out.inserted.push({ tr: ticketId, capex_item_id: Number(saved.id), valor: payload.orcamento, situacao: payload.situacao, categoria_capex: payload.categoria_capex, docsAttached: Number(attach.attached || 0) })
      existingCapex.set(key, [saved])
    } catch (error) {
      out.errors.push({ tr: id, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return out
}

function forcedPendingPayloadFromTicket(ticket: AnyRecord, reason: string) {
  const raw = ticket?.raw_instance && typeof ticket.raw_instance === 'object' ? ticket.raw_instance : ticket
  const fields = Array.isArray(ticket?.raw_fields) ? ticket.raw_fields : Array.isArray(raw?.formFields) ? raw.formFields : []
  const tasks = Array.isArray(ticket?.raw_tasks) ? ticket.raw_tasks : Array.isArray(raw?.instanceTasks) ? raw.instanceTasks : []
  const fmap = fieldMap(fields)
  const compra = isCompra(raw || ticket)
  const financeiro = isFinanceiro(raw || ticket)
  const itens = Array.isArray(ticket?.itens_json) && ticket.itens_json.length ? ticket.itens_json : extractItems(fields)
  const valor = Number(ticket?.valor_final || ticket?.valor || ticket?.pagamento_json?.valor_total || 0) || pickTicketValue(fmap, itens, financeiro)
  const desc = cleanSummaryText(ticket?.pedido || '')
    || cleanSummaryText(ticketDescription(fmap, itens, financeiro, compra))
    || cleanSummaryText(ticketDescriptionForPayment(ticket))
    || String(ticket?.request_name || raw?.requestName || `Ticket Raiz ${ticket?.zeev_instance_id || raw?.id || ''}`).trim()
  const conferir = valueIsFinalForPurchase(raw || ticket, tasks)
  const status = suggestedCapexStatus(raw || ticket, conferir)
  const campos = {
    ...fieldsObject(fields),
    _capex_forcado: true,
    _capex_forcado_motivo: reason || 'Inclusao manual solicitada pelo usuario.',
    _capex_forcado_em: new Date().toISOString(),
  }
  return {
    zeev_instance_id: Number(ticket?.zeev_instance_id || raw?.id || 0),
    zeev_uid: ticket?.zeev_uid || raw?.uid || null,
    flow_id: flowId(raw || ticket),
    flow_name: flowName(raw || ticket) || ticket?.flow_name || '',
    flow_version: flowVersion(raw || ticket) || ticket?.flow_version || null,
    request_name: ticket?.request_name || raw?.requestName || null,
    ticket_link: ticket?.ticket_link || raw?.reportLink || null,
    confirmation_code: ticket?.confirmation_code || raw?.confirmationCode || null,
    start_date_time: iso(ticket?.start_date_time || raw?.startDateTime),
    end_date_time: iso(ticket?.end_date_time || raw?.endDateTime),
    last_finished_task_date_time: iso(ticket?.last_finished_task_date_time || raw?.lastFinishedTaskDateTime),
    active: ticket?.active === undefined ? (raw?.active === undefined ? null : Boolean(raw.active)) : Boolean(ticket.active),
    flow_result: ticket?.flow_result || raw?.flowResult || '',
    capex_field_name: 'manual_codex',
    capex_field_value: 'Sim - inclusao manual',
    requester_name: ticket?.requester_name || raw?.requester?.name || '',
    requester_email: ticket?.requester_email || raw?.requester?.email || '',
    requester_username: ticket?.requester_username || raw?.requester?.username || '',
    requester_team: ticket?.requester_team || raw?.requester?.team?.name || '',
    etapa_atual: ticket?.etapa_atual || taskName(currentTask(tasks)),
    passou_conferir_entrega: Boolean(ticket?.passou_conferir_entrega || conferir),
    pronto_valor_final: Boolean(ticket?.pronto_valor_final || (compra && conferir)),
    valor: valor || null,
    valor_final: ticket?.valor_final || (valor && (!compra || conferir || financeiro) ? valor : null),
    valor_status: ticket?.valor_status || (valor ? ((compra && !conferir && !financeiro) ? 'em_aprovacao' : 'final') : 'nao_encontrado'),
    unidade: ticket?.unidade || firstField(fmap, ['unidadeEscolar', 'unidade', 'escola', 'filial', 'localEntrega']) || cleanUnit(firstField(fmap, ['centroDeCusto', 'centroCusto'])) || null,
    marca: ticket?.marca || firstField(fmap, ['marca']) || null,
    pedido: desc || null,
    categoria_capex: ticket?.categoria_capex || firstField(fmap, ['categoriaCompra', 'categoria', 'tipoCompra']) || null,
    fonte: 'UNIDADE',
    setor: ticket?.setor || (financeiro ? 'FINANCEIRO' : 'COMPRAS'),
    situacao_sugerida: ticket?.situacao_sugerida || status.situacao,
    realizado_sugerido: ticket?.realizado_sugerido ?? status.realizado,
    raw_fields: fields,
    raw_instance: raw || ticket,
    raw_tasks: tasks,
    itens_json: itens,
    pagamento_json: ticket?.pagamento_json || { ...extractPagamento(fmap), valor_total: valor || null },
    campos_extraidos: campos,
    enrichment_errors: [
      ...(Array.isArray(ticket?.enrichment_errors) ? ticket.enrichment_errors : []),
      { field: 'CAPEX', warning: reason || 'Ticket incluído manualmente na fila mesmo sem CAPEX marcado como Sim.' },
    ],
    status: 'pendente',
    capex_item_id: null,
    last_seen_at: new Date().toISOString(),
  }
}

async function forcePendingTickets(input: AnyRecord = {}) {
  const ticketIds = parseTicketIdList(input.ticketIds || input.ticket_ids || input.instanceIds || input.instance_ids || '')
  const reason = String(input.reason || input.motivo || 'Erro da solicitante: ticket deve ser tratado como CAPEX.').trim()
  if (!ticketIds.length) throw new Error('Nenhum TR informado para colocar em Registros pendentes.')
  const providedTickets = new Map<string, AnyRecord>()
  if (Array.isArray(input.tickets)) {
    for (const ticket of input.tickets) {
      const key = ticketDigits(ticket?.zeev_instance_id || ticket?.id || ticket?.raw_instance?.id || ticket?.rawInstance?.id)
      if (key) providedTickets.set(key, ticket)
    }
  }
  const directZeevRead = input.directZeevRead === true || input.direct_zeev_read === true

  const existingPending = await loadTicketsByIds(ticketIds)
  const existingCapexRows = await rest(`/capex_itens?select=id,referencia,ticket_raiz_instance_id&or=(referencia.in.(${ticketIds.join(',')}),ticket_raiz_instance_id.in.(${ticketIds.join(',')}))`)
  const existingPaymentRows = await rest(`/pagamentos?select=id,obra_id,ticket_raiz&ticket_raiz=in.(${ticketIds.join(',')})`)
  const registered = new Map<string, AnyRecord[]>()
  for (const row of [...(existingCapexRows || []), ...(existingPaymentRows || [])]) {
    const key = ticketDigits(row.ticket_raiz_instance_id || row.referencia || row.ticket_raiz)
    if (!key) continue
    const rows = registered.get(key) || []
    rows.push(row)
    registered.set(key, rows)
  }

  const out: AnyRecord = { ok: true, mode: 'force-pending-ticket', requested: ticketIds, inserted: [], updated: [], skipped: [], errors: [] }
  for (const id of ticketIds) {
    try {
      const key = ticketDigits(id)
      if (registered.has(key)) {
        out.skipped.push({ tr: id, reason: 'ja_registrado_em_capex_ou_pagamentos', ids: registered.get(key)?.map((row) => row.id) || [] })
        continue
      }
      let ticket = providedTickets.get(key) || existingPending.get(id) || { zeev_instance_id: id }
      if (!providedTickets.has(key)) {
        const hasStored = ticketHasStoredZeevData(ticket) || Boolean(ticket?.ticket_link)
        if (directZeevRead && !hasStored) {
          throw new Error('Ticket nao veio enriquecido do GitHub/Zeev; inclusao sem link foi bloqueada para evitar placeholder.')
        }
        ticket = await loadGenericTicketFromZeev(ticket)
      }
      const payload = forcedPendingPayloadFromTicket({ ...ticket, zeev_instance_id: Number(ticket?.zeev_instance_id || id) }, reason)
      if (!payload.zeev_instance_id) throw new Error('Ticket sem ID valido apos leitura do Zeev.')
      const savedRows = await upsertTickets([payload])
      const saved = savedRows?.[0] || payload
      const summary = {
        tr: id,
        row_id: saved.id || null,
        status: saved.status || 'pendente',
        ticket_link_present: Boolean(saved.ticket_link || payload.ticket_link),
        pedido_present: Boolean(saved.pedido || payload.pedido),
        valor: saved.valor ?? payload.valor ?? null,
        flow: saved.flow_name || payload.flow_name || '',
        solicitante: saved.requester_name || payload.requester_name || '',
      }
      if (existingPending.has(id)) out.updated.push(summary)
      else out.inserted.push(summary)
    } catch (error) {
      out.errors.push({ tr: id, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return out
}

function zeevProbeSummary(label: string, row: AnyRecord, flow = 0, error = '') {
  const fields = Array.isArray(row?.formFields) ? row.formFields : []
  const tasks = Array.isArray(row?.instanceTasks) ? row.instanceTasks : []
  return {
    label,
    flow,
    ok: Boolean(row && typeof row === 'object' && Object.keys(row).length),
    error,
    id: row?.id || row?.instanceId || null,
    requestName: row?.requestName || '',
    hasReportLink: Boolean(row?.reportLink || row?.reportUrl),
    reportLinkPreview: row?.reportLink ? String(row.reportLink).slice(0, 80) : '',
    flowId: row?.flow?.id || row?.flowId || null,
    flowName: row?.flow?.name || row?.flowName || '',
    requester: row?.requester?.name || '',
    requesterEmail: row?.requester?.email || '',
    fields: fields.length,
    tasks: tasks.length,
    keys: row && typeof row === 'object' ? Object.keys(row).slice(0, 24) : [],
  }
}

async function probeZeevTicket(input: AnyRecord = {}) {
  const ticketIds = parseTicketIdList(input.ticketIds || input.ticket_ids || input.instanceIds || input.instance_ids || '')
  const ticketId = ticketIds[0]
  if (!ticketId) throw new Error('Informe um TR para diagnosticar.')
  const out: AnyRecord = { ok: true, mode: 'probe-zeev-ticket', tr: ticketId, probes: [] }
  try {
    const direct = await zeevInstance(ticketId, 0, [])
    out.probes.push(zeevProbeSummary('GET /api/2/instances sem campos', direct))
  } catch (error) {
    out.probes.push(zeevProbeSummary('GET /api/2/instances sem campos', {}, 0, error instanceof Error ? error.message : String(error)))
  }
  try {
    const directCapex = await zeevInstance(ticketId, 0, ['CAPEX', 'cAPEX', 'investimentoCAPEX'])
    out.probes.push(zeevProbeSummary('GET /api/2/instances campos CAPEX', directCapex))
  } catch (error) {
    out.probes.push(zeevProbeSummary('GET /api/2/instances campos CAPEX', {}, 0, error instanceof Error ? error.message : String(error)))
  }
  for (const flow of knownZeevFlowIds(input.flowId || input.flow_id || 0)) {
    try {
      const row = await zeevInstanceReport(ticketId, flow, [])
      out.probes.push(zeevProbeSummary('POST /api/2/instances/report sem campos', row, flow))
      if (Number(row?.id) === Number(ticketId) && (row?.reportLink || row?.flow || row?.flowId)) break
    } catch (error) {
      out.probes.push(zeevProbeSummary('POST /api/2/instances/report sem campos', {}, flow, error instanceof Error ? error.message : String(error)))
    }
  }
  return out
}

async function probeZeevDocDownload(input: AnyRecord = {}) {
  const ticketId = Number(parseTicketIdList(input.ticketIds || input.ticket_ids || input.instanceIds || input.instance_ids || input.ticketId || input.ticket_id || '')[0] || 0)
  const flow = Number(input.flowId || input.flow_id || 263)
  const fieldName = String(input.fieldName || input.field_name || 'anexarBoletoParcelado').trim()
  const rowNumber = Number(input.row || input.rowNumber || input.row_number || 1)
  if (!ticketId) throw new Error('Informe um TR para diagnosticar documento.')
  const detail = await zeevInstanceReport(ticketId, flow, [fieldName])
  const fields = Array.isArray(detail?.formFields) ? detail.formFields : []
  const field = fields.find((f: AnyRecord) => String(f?.name || '') === fieldName && Number(f?.row || 1) === rowNumber) || fields.find((f: AnyRecord) => String(f?.name || '') === fieldName) || fields[0]
  const url = field?.openUrl || field?.value || ''
  const out: AnyRecord = {
    ok: true,
    mode: 'probe-zeev-doc-download',
    tr: ticketId,
    flow,
    fieldName,
    row: rowNumber,
    fieldFound: Boolean(field),
    fieldKeys: field && typeof field === 'object' ? Object.keys(field) : [],
    valueLength: String(field?.value || '').length,
    openUrlLength: String(field?.openUrl || '').length,
  }
  if (!url) return { ...out, ok: false, error: 'Campo sem URL/valor de documento.' }
  try {
    const file = await downloadZeevDoc({ name: fieldName, url, source: fieldName })
    return {
      ...out,
      downloaded: Boolean(file),
      type: file?.type || '',
      name: file?.name || '',
      bytes: file?.body ? file.body.byteLength : 0,
    }
  } catch (error) {
    return {
      ...out,
      downloaded: false,
      error: error instanceof Error ? error.message.slice(0, 800) : String(error).slice(0, 800),
    }
  }
}

async function registerObraPayments(input: AnyRecord = {}) {
  const ticketIds = parseTicketIdList(input.ticketIds || input.ticket_ids || input.instanceIds || input.instance_ids || '')
  const obraName = String(input.obraName || input.targetObra || input.target_obra || input.obra || '').trim()
  const escopo = input.escopo === 'extra' || input.targetEscopo === 'extra' || input.target_escopo === 'extra' ? 'extra' : 'obra'
  const requestedFileLimit = input.fileLimit ?? input.file_limit ?? 5
  const fileLimit = Math.max(0, Math.min(Number(requestedFileLimit), 40))
  if (!ticketIds.length) throw new Error('Nenhum TR informado para registrar como pagamento.')
  if (!obraName) throw new Error('Informe a obra destino para registrar os pagamentos.')

  const obras = await restAll('/obras?select=id,nome,marca,unidades_obra')
  const obra = findTargetObra(obras, obraName)
  if (!obra) throw new Error(`Obra destino nao encontrada: ${obraName}`)

  const existingRows = await rest(`/pagamentos?select=id,obra_id,ticket_raiz,nf_doc_path,comp_doc_path,docs_json,st,paga_em,venc,obs&ticket_raiz=in.(${ticketIds.join(',')})`)
  const existingByTicket = new Map<string, AnyRecord[]>()
  for (const row of existingRows || []) {
    const key = ticketDigits(row.ticket_raiz)
    if (!key) continue
    const rows = existingByTicket.get(key) || []
    rows.push(row)
    existingByTicket.set(key, rows)
  }

  const dbTickets = await loadTicketsByIds(ticketIds)
  const out: AnyRecord = { ok: true, mode: 'register-obra-payments', obra: { id: obra.id, nome: obra.nome }, escopo, requested: ticketIds, inserted: [], updated: [], skipped: [], errors: [], docsAttached: 0, paidUpdated: 0 }

  for (const id of ticketIds) {
    try {
      const storedTicket = dbTickets.get(id)
      const hasStoredTicketData = Boolean(
        storedTicket && (
          storedTicket.pedido ||
          storedTicket.valor ||
          storedTicket.valor_final ||
          storedTicket.ticket_link ||
          Object.keys(storedTicket.campos_extraidos || {}).length ||
          (Array.isArray(storedTicket.raw_fields) && storedTicket.raw_fields.length) ||
          (Array.isArray(storedTicket.itens_json) && storedTicket.itens_json.length)
        ),
      )
      let ticket = hasStoredTicketData ? storedTicket : (storedTicket || { zeev_instance_id: id })
      if (!hasStoredTicketData) ticket = await loadGenericTicketFromZeev(ticket)
      const ticketId = Number(ticket?.zeev_instance_id || id)
      if (!ticketId) {
        out.skipped.push({ tr: id, reason: 'ticket_nao_encontrado' })
        continue
      }
      const payload = paymentPayloadFromTicket({ ...ticket, zeev_instance_id: ticketId }, obra, escopo)
      if (!payload.v) out.errors.push({ tr: ticketId, warning: 'valor_nao_encontrado_no_zeev' })
      const currentRows = existingByTicket.get(ticketDigits(ticketId)) || []
      const target = currentRows.find((row) => Number(row.obra_id) === Number(obra.id)) || currentRows[0] || null
      const savedRows = target
        ? await rest(`/pagamentos?id=eq.${Number(target.id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) })
        : await rest('/pagamentos', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([payload]) })
      const saved = Array.isArray(savedRows) ? savedRows[0] : savedRows
      if (!saved?.id) throw new Error('Supabase nao retornou o pagamento salvo.')

      let attach: AnyRecord = { docs: saved.docs_json || [], attached: 0, nfPath: saved.nf_doc_path || '', compPath: saved.comp_doc_path || '' }
      if (fileLimit > 0) {
        try {
          attach = await attachDocsForTarget('payment', saved, { ...ticket, zeev_instance_id: ticketId }, fileLimit)
        } catch (error) {
          out.errors.push({ tr: ticketId, step: 'anexos', error: error instanceof Error ? error.message : String(error) })
        }
      }
      const paidDate = paymentDateFromTicket(ticket)
      const lifecycleStatus = paymentLifecycleStatusFromTicket(ticket)
      const patch: AnyRecord = { zeev_docs_checked_at: new Date().toISOString() }
      if (JSON.stringify(attach.docs || []) !== JSON.stringify(saved.docs_json || [])) patch.docs_json = attach.docs || []
      if (!saved.nf_doc_path && attach.nfPath) patch.nf_doc_path = attach.nfPath
      if (!saved.comp_doc_path && attach.compPath) patch.comp_doc_path = attach.compPath
      if (paidDate && (saved.st !== 'PAGO' || saved.paga_em !== paidDate)) {
        patch.st = 'PAGO'
        patch.paga_em = paidDate
        out.paidUpdated++
      } else if (!paidDate && lifecycleStatus && saved.st !== lifecycleStatus) {
        patch.st = lifecycleStatus
        patch.paga_em = ''
      }
      await rest(`/pagamentos?id=eq.${Number(saved.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) })
      out.docsAttached += Number(attach.attached || 0)

      await rest(`/capex_zeev_solicitacoes?zeev_instance_id=eq.${ticketId}&status=eq.pendente`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'aprovado',
          capex_item_id: null,
          aprovado_em: new Date().toISOString(),
          aprovado_por: 'pagamento_obra_lote',
        }),
      })

      const item = { tr: ticketId, pagamento_id: Number(saved.id), obra_id: Number(obra.id), valor: payload.v, docsAttached: Number(attach.attached || 0) }
      if (target) out.updated.push(item)
      else out.inserted.push(item)
      if (currentRows.length > 1) out.errors.push({ tr: ticketId, warning: 'pagamento_duplicado_preexistente', ids: currentRows.map((row) => row.id) })
    } catch (error) {
      out.errors.push({ tr: id, error: error instanceof Error ? error.message : String(error) })
    }
  }

  return out
}

async function runFileProxy(input: AnyRecord) {
  const url = safeZeevFileUrl(input?.url)
  if (!url) return json({ ok: false, error: 'URL Zeev invalida.' }, 400)
  if (!zeevToken()) return json({ ok: false, error: 'ZEEV_TOKEN ausente nos secrets da Supabase.' }, 500)
  let res: Response
  try {
    res = await zeevBinaryRequest(url, {
      headers: {
        Accept: '*/*',
        'User-Agent': 'RaizObraViva/1.0 (+https://raiz-obras.vercel.app)',
      },
    })
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500) }, 502)
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
    BAD_ZEEV_TOKENS.clear()
    REQUEST_ZEEV_TOKEN = String(input?.zeevToken || input?.zeev_token || req.headers.get('x-zeev-token') || '').trim()
    REQUEST_ZEEV_EXTRA_TOKENS = requestListInput(input?.zeevExtraTokens || input?.zeev_extra_tokens || input?.extraZeevTokens || input?.extra_zeev_tokens || req.headers.get('x-zeev-extra-tokens'))
    REQUEST_ZEEV_EXTRA_DOCUMENT_FIELDS = requestListInput(input?.extraDocumentFields || input?.extra_document_fields || req.headers.get('x-zeev-extra-document-fields'))
    REQUEST_ZEEV_FILE_DOWNLOAD_URL_TEMPLATE = String(input?.fileDownloadUrlTemplate || input?.file_download_url_template || req.headers.get('x-zeev-file-download-url-template') || '').trim()
    let mode = String(input?.mode || '').trim()
    if (!mode && ticketIdsFromEventInput(input || {}).length) mode = 'webhook-ticket'
    if (mode === 'health') {
      if (!secretAuthorized(req)) return json({ ok: false, error: 'Nao autorizado.' }, 401)
      return json(await runHealth(input || {}))
    }
    if (automationPaused(mode) && secretAuthorized(req)) {
      return json({ ok: true, mode, skipped: true, reason: 'ZEEV_AUTOMATION_PAUSED' })
    }
    if (secretAuthorized(req) && automationModeCanPause(mode)) {
      const health = await runHealth({ ignorePause: true })
      if (!health.ok) return json({ ok: true, mode, skipped: true, reason: 'supabase_rest_unhealthy', health })
    }
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
    if (input?.mode === 'reconcile-registered') {
      if (!secretAuthorized(req)) await requireAppUser(req)
      const out = await reconcilePendingTicketsAlreadyRegistered()
      return json(out)
    }
    if (input?.mode === 'backfill-docs') {
      if (!secretAuthorized(req)) await requireAppUser(req)
      const out = await runBackfillDocs(input || {})
      return json(out)
    }
    if (input?.mode === 'doc-rescue-candidates') {
      if (!secretAuthorized(req)) await requireAppUser(req)
      const out = await runDocRescueCandidates(input || {})
      return json(out)
    }
    if (input?.mode === 'doc-rescue-audit') {
      if (!secretAuthorized(req)) await requireAppUser(req)
      const out = await runDocRescueAudit(input || {})
      return json(out)
    }
    if (input?.mode === 'doc-rescue-detail') {
      if (!secretAuthorized(req)) await requireAppUser(req)
      const out = await runDocRescueDetail(input || {})
      return json(out)
    }
    if (input?.mode === 'probe-zeev-doc-download') {
      if (!secretAuthorized(req)) await requireAppUser(req)
      const out = await probeZeevDocDownload(input || {})
      return json(out)
    }
    if (input?.mode === 'rescue-docs-block-report') {
      if (!secretAuthorized(req)) await requireAppUser(req)
      const out = await runRescueBlockReport(input || {})
      return json(out)
    }
    if (input?.mode === 'refresh-payment-statuses') {
      if (!secretAuthorized(req)) await requireAppUser(req)
      const out = await runRefreshPaymentStatuses(input || {})
      return json(out)
    }
    if (mode === 'webhook-ticket' || mode === 'webhook') {
      if (!secretAuthorized(req)) return json({ ok: false, error: 'Nao autorizado.' }, 401)
      const requested = ticketIdsFromEventInput(input || {})
      if (!requested.length) return json({ ok: false, mode, error: 'Webhook recebido sem numero de TR/instanceId.' }, 400)
      const shouldWait = input?.wait === true || input?.sync === true
      const payload = { ...(input || {}), mode, ticketIds: requested.join(',') }
      const waitUntil = (globalThis as AnyRecord).EdgeRuntime?.waitUntil
      if (!shouldWait && typeof waitUntil === 'function') {
        waitUntil(runWebhookTicketSync(payload).catch((error: unknown) => console.error('webhook-ticket:', error instanceof Error ? error.message : String(error))))
        return json({ ok: true, mode: 'webhook-ticket', accepted: true, async: true, requested }, 202)
      }
      const out = await runWebhookTicketSync(payload)
      return json(out)
    }
    if (input?.mode === 'register-obra-payments') {
      if (!secretAuthorized(req)) await requireAppUser(req)
      const out = await registerObraPayments(input || {})
      return json(out)
    }
    if (input?.mode === 'register-capex-items') {
      if (!secretAuthorized(req)) await requireAppUser(req)
      const out = await registerCapexItems(input || {})
      return json(out)
    }
    if (input?.mode === 'force-pending-ticket') {
      if (!secretAuthorized(req)) await requireAppUser(req)
      const out = await forcePendingTickets(input || {})
      return json(out)
    }
    if (input?.mode === 'probe-zeev-ticket') {
      if (!secretAuthorized(req)) await requireAppUser(req)
      const out = await probeZeevTicket(input || {})
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

