// Supabase Edge Function: read-invoice (v9)
// Brazilian fiscal/payment document extraction with Gemini + optional OCR fallbacks.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DOCUMENT_PROMPT = `You are a senior Brazilian accounts-payable analyst for construction projects.
Read the attached document carefully and extract real data only. The document may be:
- NF-e model 55, DANFE, product invoice XML/PDF/image
- NFC-e model 65, consumer invoice/coupon
- NFS-e/DANFSE, service invoice from any municipality or national standard
- CT-e/DACTE, transport/freight invoice
- boleto bancario, fatura, recibo/RPA, guia/tax document such as DARF, DAS, GPS, GNRE, DARM
- scanned image, photo, PDF, exported HTML/text, or mixed quality OCR

Critical rules:
1. Never confuse issuer/provider/beneficiary with recipient/taker/payer.
2. For NF-e/NFC-e/CT-e, read the printed 44-digit access key if visible.
3. For NFS-e, read the verification code when available.
4. For boletos, read linha_digitavel/codigo_barras, due date, beneficiary and amount.
5. For faturas/recibos/guias, read document number, issue date, due date, payer/beneficiary, amount and description.
6. Extract every product/service line item that is visible. Do not invent missing items.
7. Dates must be YYYY-MM-DD. Numbers must be plain decimals with dot separator.
8. Unknown fields must be null, empty arrays, or zero. Return only valid JSON.
9. Evidence first: if OCR is unclear, fragmented, or ambiguous, return null/0 for that field instead of guessing.
10. Do not infer totals from the largest number on the page. Use only values explicitly labeled as total, valor da nota, valor liquido, valor dos servicos, valor do documento, or valor a pagar.
11. Do not infer company names from arbitrary uppercase lines. For NFS-e, emitente must come from the PRESTADOR/provider block only.

Issuer/provider self-check:
- NF-e/NFC-e/CT-e: emitente is the company in EMITENTE/REMETENTE, never DESTINATARIO.
- NFS-e: emitente is PRESTADOR DE SERVICOS, never TOMADOR DE SERVICOS, CONTRATANTE, DESTINATARIO, INTERMEDIARIO, PAGADOR or the school/project owner.
- Boleto: emitente is BENEFICIARIO/CEDENTE/FAVORECIDO, never SACADO/PAGADOR.
- If both provider and taker appear, fill emitente with provider and tomador with taker. Do not copy tomador into emitente.
- For NFS-e, numero_nf is the Nota Fiscal/NFS-e number only. Put verification code in codigo_verificacao, not in numero_nf.
- numero_nf must contain only the invoice number itself. Do not include NF-e/NFS-e prefix, serie, RPS, verification code, access key, CNPJ, date, city code or any label text. If the visible field says "Numero/Serie", use only the number before the serie.

Return this JSON shape:
{
  "tipo_documento":"NF-e|NFC-e|NFS-e|CT-e|Boleto|Fatura|Recibo|Guia|Outro",
  "numero_nf":null,
  "serie":null,
  "data_emissao":null,
  "data_vencimento":null,
  "chave_acesso":null,
  "linha_digitavel":null,
  "codigo_barras":null,
  "codigo_verificacao":null,
  "emitente":{"razao_social":null,"cnpj":null},
  "tomador":{"razao_social":null,"cnpj":null},
  "itens":[{"descricao":null,"quantidade":1,"unidade":"UN","valor_unitario":0,"valor_total":0}],
  "discriminacao":null,
  "valores":{"subtotal":0,"desconto":0,"frete":0,"valor_total":0},
  "pagamento":{"forma":"A_VISTA|PARCELADO|BOLETO|PIX|CARTAO|OUTRO","num_parcelas":1,"parcelas":[{"numero":1,"valor":0,"vencimento":null}]},
  "observacoes":null
}`

const TEXT_PROMPT = DOCUMENT_PROMPT + `

The input below is OCR/raw text extracted from the document. Preserve all useful details and return only the same JSON shape.
OCR text may contain recognition errors. Never "repair" a field by imagination. Only fill values that are explicitly present in the OCR text.`

type AnyRecord = Record<string, any>

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()
    const rawText = String(body?.rawText || body?.text || '')
    const imageBase64 = String(body?.imageBase64 || '')
    const mediaType = String(body?.mediaType || 'application/pdf')

    const attempts: string[] = []
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''
    let merged: AnyRecord | null = null
    const consider = (stage: string, normalized: AnyRecord) => {
      if (!hasUsefulData(normalized)) {
        attempts.push(stage + ': sem campos uteis')
        return false
      }
      const preferNew = normalized?.tipo_documento === 'NFS-e' && stage !== 'Gemini direto'
      merged = preferNew ? mergeNormalizedData(normalized, merged) : mergeNormalizedData(merged, normalized)
      const missing = missingPaymentFields(merged)
      attempts.push(stage + ': leu ' + describeFoundFields(normalized) + '; faltando ' + (missing.length ? missing.join(', ') : 'nada'))
      return missing.length === 0
    }

    if (rawText.trim()) {
      const normalized = await extractFromOcrText(rawText, geminiKey, 'client-text')
      if (consider('Texto completo do cliente', normalized)) return ok(merged || {}, attempts)
      if (merged && hasUsefulData(merged)) return ok(merged, attempts)
      throw new Error('Nao foi possivel extrair dados suficientes do texto completo. Tentativas: ' + attempts.join(' | '))
    }

    if (!imageBase64) throw new Error('imageBase64 ou rawText ausente')

    if (geminiKey) {
      try {
        const raw = await callGeminiDocument(geminiKey, imageBase64, mediaType)
        const normalized = normalizeData(raw, 'gemini-direct')
        if (consider('Gemini direto', normalized) && normalized.tipo_documento !== 'NFS-e') return ok(merged || {}, attempts)
        if (normalized.tipo_documento === 'NFS-e') attempts.push('Gemini direto NFS-e exige confirmacao por texto/OCR antes de encerrar')
      } catch (err) {
        attempts.push('Gemini direto: ' + errorMessage(err))
      }
    } else {
      attempts.push('Secret GEMINI_API_KEY nao configurado')
    }

    const mistralKey = Deno.env.get('MISTRAL_API_KEY') || ''
    if (mistralKey) {
      try {
        const text = await callMistralOcr(mistralKey, imageBase64, mediaType)
        const normalized = await extractFromOcrText(text, geminiKey, 'mistral-ocr')
        if (consider('Mistral OCR + IA', normalized)) return ok(merged || {}, attempts)
      } catch (err) {
        attempts.push('Mistral OCR: ' + errorMessage(err))
      }
    }

    const ocrSpaceKey = Deno.env.get('OCR_SPACE_API_KEY') || Deno.env.get('OCRSPACE_API_KEY') || 'helloworld'
    if (Deno.env.get('OCR_SPACE_DISABLED') !== '1') {
      try {
        const source = ocrSpaceKey === 'helloworld' ? 'ocr-space-free-demo' : 'ocr-space-free'
        const text = await callOcrSpace(ocrSpaceKey, imageBase64, mediaType)
        const normalized = await extractFromOcrText(text, geminiKey, source)
        if (consider('OCR.space + IA', normalized)) return ok(merged || {}, attempts)
      } catch (err) {
        const hint = ocrSpaceKey === 'helloworld' ? ' (chave demo gratuita, limite bem baixo; configure OCR_SPACE_API_KEY gratuita para producao)' : ''
        attempts.push('OCR.space gratuito' + hint + ': ' + errorMessage(err))
      }
    }

    if (merged && hasUsefulData(merged)) return ok(merged, attempts)
    throw new Error('Nao foi possivel extrair dados suficientes. Tentativas: ' + attempts.join(' | '))
  } catch (err) {
    return json({ ok: false, error: errorMessage(err) })
  }
})

async function extractFromOcrText(text: string, geminiKey: string, source: string) {
  if (!text.trim()) throw new Error('OCR sem texto extraido')
  const strictLocal = normalizeData(extractStrictText(text), source + '+regex-estrito')

  if (geminiKey) {
    const chunks = splitTextForGemini(text)
    const chunkErrors: string[] = []
    let merged: AnyRecord | null = null

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      if (!chunk.trim()) continue
      try {
        const raw = await callGeminiTextChunk(geminiKey, chunk, i + 1, chunks.length)
        const normalized = validateDataAgainstText(normalizeData(raw, source + `+gemini-bloco-${i + 1}-de-${chunks.length}`), chunk)
        merged = mergeNormalizedData(merged, normalized)
      } catch (err) {
        chunkErrors.push(`bloco ${i + 1}/${chunks.length}: ${errorMessage(err)}`)
      }
    }

    if (merged && hasUsefulData(merged)) {
      merged = mergeNormalizedData(strictLocal, merged)
      merged._meta = {
        ...(merged._meta || {}),
        source: source + (chunks.length > 1 ? '+gemini-blocos' : '+gemini'),
        textLength: text.length,
        textChunks: chunks.length,
        chunkErrors: chunkErrors.slice(0, 5),
      }
      return merged
    }

    if (chunkErrors.length) {
      strictLocal._meta = {
        ...(strictLocal._meta || {}),
        source: source + '+regex-estrito',
        textLength: text.length,
        textChunks: chunks.length,
        geminiChunkErrors: chunkErrors.slice(0, 5),
      }
    }
  }

  return strictLocal
}

function splitTextForGemini(text: string, targetSize = 60000, overlap = 2500) {
  const full = String(text || '')
  if (full.length <= targetSize) return [full]
  const chunks: string[] = []
  let start = 0
  while (start < full.length) {
    let end = Math.min(full.length, start + targetSize)
    if (end < full.length) {
      const lineBreak = full.lastIndexOf('\n', end)
      const space = full.lastIndexOf(' ', end)
      const boundary = Math.max(lineBreak, space)
      if (boundary > start + Math.floor(targetSize * 0.65)) end = boundary
    }
    chunks.push(full.slice(start, end))
    if (end >= full.length) break
    start = Math.max(start + 1, end - overlap)
  }
  return chunks
}

function mergeNormalizedData(primary: AnyRecord | null, secondary: AnyRecord | null) {
  if (!secondary) return primary || {}
  if (!primary) return JSON.parse(JSON.stringify(secondary))
  const out: AnyRecord = JSON.parse(JSON.stringify(primary))
  const fill = (key: string) => {
    if (isBlank(out[key]) && !isBlank(secondary[key])) out[key] = secondary[key]
  }
  ;['tipo_documento', 'numero_nf', 'serie', 'data_emissao', 'data_vencimento', 'chave_acesso', 'linha_digitavel', 'codigo_barras', 'codigo_verificacao', 'discriminacao', 'observacoes'].forEach(fill)
  if (secondary.tipo_documento && (!out.tipo_documento || (out.tipo_documento === 'NF-e' && secondary.tipo_documento !== 'NF-e'))) out.tipo_documento = secondary.tipo_documento

  out.emitente = { ...(out.emitente || {}) }
  const secEmit = secondary.emitente || {}
  if (isBlank(out.emitente.razao_social) && !isBlank(secEmit.razao_social)) out.emitente.razao_social = cleanCompanyName(secEmit.razao_social)
  if (isBlank(out.emitente.cnpj) && !isBlank(secEmit.cnpj)) out.emitente.cnpj = secEmit.cnpj

  out.valores = { ...(out.valores || {}) }
  const secVal = secondary.valores || {}
  ;['subtotal', 'desconto', 'frete'].forEach((key) => {
    if (!num(out.valores[key]) && num(secVal[key])) out.valores[key] = secVal[key]
  })
  const totalB = num(secVal.valor_total)
  if (!num(out.valores.valor_total) && totalB) out.valores.valor_total = totalB

  out.pagamento = { ...(out.pagamento || {}) }
  const secPag = secondary.pagamento || {}
  if ((out.pagamento.forma === 'A_VISTA' || isBlank(out.pagamento.forma)) && !isBlank(secPag.forma)) out.pagamento.forma = secPag.forma
  out.pagamento.num_parcelas = Math.max(Number(out.pagamento.num_parcelas || 1), Number(secPag.num_parcelas || 1))
  out.pagamento.parcelas = mergeParcelas(out.pagamento.parcelas || [], secPag.parcelas || [])

  out.itens = mergeItems(out.itens || [], secondary.itens || [])
  out._meta = { ...(out._meta || {}), ...(secondary._meta || {}) }
  return out
}

function validateDataAgainstText(data: AnyRecord, text: string) {
  const out: AnyRecord = JSON.parse(JSON.stringify(data || {}))
  const full = String(text || '')
  const norm = stripAccents(full).toLowerCase()
  const digits = onlyDigits(full)
  const tipo = normalizeTipo(out.tipo_documento)
  out.emitente = { ...(out.emitente || {}) }
  out.valores = { ...(out.valores || {}) }

  if (['NF-e', 'NFC-e', 'NFS-e', 'CT-e'].includes(tipo)) {
    out.numero_nf = normalizeInvoiceNumber(out.numero_nf, tipo, out.chave_acesso) || null
    out.serie = null
  }

  if (tipo === 'NFS-e') {
    const prestadorBlock = findSection(full, [/^\s*prestador(?:\s+de\s+servi\S*)?\s*:?\s*$/i, /^\s*dados\s+do\s+prestador/i], [/^\s*tomador\b/i, /^\s*intermediario\b/i, /^\s*discriminacao\b/i, /^\s*servicos\b/i, /^\s*valores\b/i])
    const prestadorNorm = stripAccents(prestadorBlock).toLowerCase()
    const emitName = cleanStr(out.emitente?.razao_social)
    const emitCnpj = onlyDigits(out.emitente?.cnpj || '')
    if (emitName && !containsLoose(prestadorNorm, emitName)) out.emitente.razao_social = null
    if (emitCnpj && !onlyDigits(prestadorBlock).includes(emitCnpj)) out.emitente.cnpj = null
  }

  const emitCnpj = onlyDigits(out.emitente?.cnpj || '')
  if (emitCnpj && !digits.includes(emitCnpj)) out.emitente.cnpj = null

  const numeroDigits = onlyDigits(out.numero_nf || '')
  if (numeroDigits && numeroDigits.length >= 3 && !digits.includes(numeroDigits)) out.numero_nf = null

  const chave = onlyDigits(out.chave_acesso || '')
  if (chave && !digits.includes(chave)) out.chave_acesso = null

  const linha = onlyDigits(out.linha_digitavel || '')
  if (linha && !digits.includes(linha)) out.linha_digitavel = null

  const codBar = onlyDigits(out.codigo_barras || '')
  if (codBar && !digits.includes(codBar)) out.codigo_barras = null

  const valor = num(out.valores?.valor_total)
  if (valor && !moneyAppears(full, valor)) {
    out.valores.valor_total = 0
    if (num(out.valores.subtotal) === valor) out.valores.subtotal = 0
  }

  if (out.data_emissao && !dateAppears(full, out.data_emissao)) out.data_emissao = null
  if (out.data_vencimento && !dateAppears(full, out.data_vencimento)) out.data_vencimento = null

  if (out.discriminacao && !containsLoose(norm, out.discriminacao) && String(out.discriminacao).length > 30) out.discriminacao = null
  out.itens = Array.isArray(out.itens)
    ? out.itens.filter((it: AnyRecord) => !it?.descricao || containsLoose(norm, it.descricao) || String(it.descricao).length <= 30)
    : []

  out._meta = { ...(out._meta || {}), evidenceChecked: true }
  return out
}

function containsLoose(normalizedHaystack: string, rawNeedle: unknown) {
  const needle = stripAccents(String(rawNeedle || '')).toLowerCase().replace(/[^\w]+/g, ' ').trim()
  if (!needle) return false
  const hay = normalizedHaystack.replace(/[^\w]+/g, ' ')
  if (hay.includes(needle)) return true
  const tokens = needle.split(/\s+/).filter((t) => t.length > 2)
  if (tokens.length < 2) return false
  return tokens.filter((t) => hay.includes(t)).length >= Math.min(tokens.length, 3)
}

function moneyAppears(text: string, value: number) {
  const rounded = round2(value)
  const br = rounded.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const plainBr = br.replace(/\./g, '')
  const us = rounded.toFixed(2)
  const candidates = [br, plainBr, us, us.replace('.', ',')]
  return candidates.some((c) => String(text || '').includes(c))
}

function dateAppears(text: string, iso: string) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return false
  const [, y, mo, d] = m
  const yy = y.slice(2)
  const candidates = [`${d}/${mo}/${y}`, `${d}-${mo}-${y}`, `${d}/${mo}/${yy}`, `${d}-${mo}-${yy}`, `${y}-${mo}-${d}`]
  return candidates.some((c) => String(text || '').includes(c))
}

function mergeItems(a: AnyRecord[], b: AnyRecord[]) {
  const out = [...a]
  const seen = new Set(out.map((it) => itemKey(it)).filter(Boolean))
  for (const item of b) {
    const key = itemKey(item)
    if (!key || seen.has(key)) continue
    out.push(item)
    seen.add(key)
  }
  return out
}

function mergeParcelas(a: AnyRecord[], b: AnyRecord[]) {
  const out = [...a]
  const seen = new Set(out.map((p) => `${p.numero || ''}|${p.valor || ''}|${p.vencimento || ''}`))
  for (const parcela of b) {
    const key = `${parcela.numero || ''}|${parcela.valor || ''}|${parcela.vencimento || ''}`
    if (seen.has(key)) continue
    out.push(parcela)
    seen.add(key)
  }
  return out
}

function itemKey(item: AnyRecord) {
  return stripAccents(String(item?.descricao || '')).toLowerCase().replace(/\s+/g, ' ').trim()
}

function isBlank(value: unknown) {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0)
}

async function callGeminiText(key: string, text: string) {
  return callGeminiTextChunk(key, text, 1, 1)
}

async function callGeminiTextChunk(key: string, text: string, index: number, total: number) {
  const chunkNote = total > 1
    ? `\n\nThis is OCR/raw text chunk ${index} of ${total}. Extract every payment/invoice field visible in this chunk. The server will merge all chunks, so do not ignore line items, dates, totals, barcodes, or identifiers just because they look partial.`
    : ''
  const parts = [{ text: TEXT_PROMPT + chunkNote + '\n\nOCR_TEXT:\n' + text }]
  return callGemini(key, parts, 'text')
}

async function callGeminiDocument(key: string, imageBase64: string, mediaType: string) {
  const parts = [
    { inlineData: { mimeType: mediaType || 'application/pdf', data: imageBase64 } },
    { text: DOCUMENT_PROMPT },
  ]
  return callGemini(key, parts, 'document')
}

async function callGemini(key: string, parts: AnyRecord[], mode: string) {
  const envModels = (Deno.env.get('GEMINI_MODELS') || Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash,gemini-2.5-flash-lite')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
  const models = [...new Set(envModels)]
  const errors: string[] = []

  for (const model of models) {
    try {
      const resp = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              maxOutputTokens: 16384,
              temperature: 0,
              responseMimeType: 'application/json',
            },
          }),
        },
        mode === 'document' ? 65000 : 45000,
      )

      if (!resp.ok) {
        const msg = await resp.text()
        errors.push(`${model} HTTP ${resp.status}: ${msg.slice(0, 260)}`)
        continue
      }

      const data = await resp.json()
      const text = data?.candidates?.[0]?.content?.parts?.map((p: AnyRecord) => p.text || '').join('\n') || ''
      if (!text.trim()) {
        errors.push(`${model}: resposta vazia`)
        continue
      }
      return parseJsonObject(text)
    } catch (err) {
      errors.push(`${model}: ${errorMessage(err)}`)
    }
  }

  throw new Error(errors.join(' | '))
}

async function callMistralOcr(key: string, imageBase64: string, mediaType: string) {
  const isPdf = /pdf/i.test(mediaType)
  const docKey = isPdf ? 'document_url' : 'image_url'
  const payload = {
    model: 'mistral-ocr-latest',
    document: {
      type: isPdf ? 'document_url' : 'image_url',
      [docKey]: `data:${mediaType};base64,${imageBase64}`,
    },
    table_format: 'markdown',
    include_image_base64: false,
  }

  const resp = await fetchWithTimeout('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  }, 65000)

  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 260)}`)
  const data = await resp.json()
  const pages = Array.isArray(data?.pages) ? data.pages : []
  const text = pages.map((p: AnyRecord) => p.markdown || p.text || '').filter(Boolean).join('\n\n')
  if (!text.trim()) throw new Error('resposta sem paginas OCR')
  return text
}

async function callOcrSpace(key: string, imageBase64: string, mediaType: string) {
  const form = new FormData()
  form.append('base64Image', `data:${mediaType};base64,${imageBase64}`)
  form.append('language', 'por')
  form.append('isOverlayRequired', 'false')
  form.append('detectOrientation', 'true')
  form.append('scale', 'true')
  form.append('OCREngine', '2')

  const resp = await fetchWithTimeout('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: { apikey: key },
    body: form,
  }, 65000)

  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 260)}`)
  const data = await resp.json()
  if (data?.IsErroredOnProcessing) {
    throw new Error([data.ErrorMessage, data.ErrorDetails].flat().filter(Boolean).join(' | ') || 'erro no OCR')
  }
  const text = (data?.ParsedResults || []).map((r: AnyRecord) => r.ParsedText || '').filter(Boolean).join('\n\n')
  if (!text.trim()) throw new Error('resposta sem ParsedText')
  return text
}

function normalizeData(input: AnyRecord, source: string) {
  const valores = input?.valores || {}
  const pagamento = input?.pagamento || {}
  const tipo = normalizeTipo(input?.tipo_documento || input?.tipo || input?.document_type)
  const emit = tipo === 'NFS-e'
    ? (input?.emitente || input?.prestador || {})
    : (input?.emitente || input?.prestador || input?.beneficiario || {})
  const total = num(valores.valor_total ?? input.valor_total ?? input.total ?? input.valor)
  const subtotal = num(valores.subtotal ?? valores.valor_servicos ?? input.subtotal) || total
  const desconto = num(valores.desconto ?? input.desconto)
  const frete = num(valores.frete ?? input.frete)
  const itens = normalizeItems(input?.itens || input?.items || [], tipo, total)
  const chave = cleanStr(input?.chave_acesso || input?.chave || '')
  const rawNumero = input?.numero_nf ?? input?.numero ?? input?.numero_documento
  const numero = ['NF-e', 'NFC-e', 'NFS-e', 'CT-e'].includes(tipo) ? normalizeInvoiceNumber(rawNumero, tipo, chave) : cleanStr(rawNumero)
  const linha = cleanStr(input?.linha_digitavel || '')
  const barcode = cleanStr(input?.codigo_barras || '')
  const codVer = cleanStr(input?.codigo_verificacao || '')

  return {
    tipo_documento: tipo,
    numero_nf: numero || null,
    serie: null,
    data_emissao: dateIso(input?.data_emissao || input?.emissao || input?.date),
    data_vencimento: dateIso(input?.data_vencimento || input?.vencimento || pagamento?.vencimento),
    chave_acesso: onlyDigits(chave).length === 44 ? onlyDigits(chave) : (tipo === 'NFS-e' ? null : chave || null),
    linha_digitavel: linha || null,
    codigo_barras: barcode || null,
    codigo_verificacao: codVer || (tipo === 'NFS-e' && chave ? chave : null),
    emitente: {
      razao_social: cleanCompanyName(emit.razao_social || emit.nome || input.razao_social || input.ben || input.beneficiario) || null,
      cnpj: formatCnpj(emit.cnpj || input.cnpj) || null,
    },
    itens,
    discriminacao: cleanStr(input?.discriminacao || input?.descricao || input?.desc) || null,
    valores: { subtotal, desconto, frete, valor_total: total || sumItems(itens) || subtotal || 0 },
    pagamento: {
      forma: normalizeForma(pagamento.forma || input.forma_pagamento || (tipo === 'Boleto' ? 'BOLETO' : 'A_VISTA')),
      num_parcelas: Math.max(1, Number(pagamento.num_parcelas || pagamento.parcelas?.length || 1) || 1),
      parcelas: normalizeParcelas(pagamento.parcelas || [], total),
    },
    observacoes: cleanStr(input?.observacoes || input?.obs) || null,
    _meta: { source },
  }
}

function normalizeItems(items: AnyRecord[], tipo: string, total: number) {
  if (!Array.isArray(items)) return []
  const unitDefault = ['NFS-e', 'CT-e', 'Boleto', 'Fatura', 'Recibo', 'Guia'].includes(tipo) ? 'Srv' : 'UN'
  return items.map((it) => {
    const desc = cleanStr(it?.descricao || it?.description || it?.nome || it?.servico)
    if (!desc) return null
    const qtd = num(it?.quantidade ?? it?.qtd) || 1
    const vt = num(it?.valor_total ?? it?.total ?? it?.valor) || total || 0
    const vu = num(it?.valor_unitario ?? it?.unitario) || (qtd ? vt / qtd : vt)
    return {
      descricao: desc,
      quantidade: qtd,
      unidade: cleanStr(it?.unidade || it?.un || unitDefault) || unitDefault,
      valor_unitario: round2(vu),
      valor_total: round2(vt),
    }
  }).filter(Boolean)
}

function normalizeParcelas(items: AnyRecord[], total: number) {
  if (!Array.isArray(items)) return []
  return items.map((p, idx) => ({
    numero: Number(p?.numero || p?.n || idx + 1) || idx + 1,
    valor: num(p?.valor) || (items.length ? round2(total / items.length) : 0),
    vencimento: dateIso(p?.vencimento || p?.data),
  })).filter((p) => p.valor || p.vencimento)
}

function extractStrictText(rawText: string) {
  const text = String(rawText || '').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ')
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const norm = stripAccents(text).toLowerCase()
  const digits = text.replace(/\D/g, '')
  const chave = (digits.match(/\d{44}/) || [])[0] || ''
  const decoded = chave ? decodeAccessKey(chave) : null

  let tipo = decoded?.tipo || 'NF-e'
  if (/nfs-?e|nota fiscal de servicos|prestador de servicos|danfse/.test(norm)) tipo = 'NFS-e'
  else if (/ct-?e|dacte|conhecimento de transporte/.test(norm)) tipo = 'CT-e'
  else if (/nfc-?e|cupom fiscal eletronico/.test(norm)) tipo = 'NFC-e'
  else if (/boleto|linha digitavel|nosso numero|cedente|sacado/.test(norm)) tipo = 'Boleto'
  else if (/fatura|invoice|demonstrativo|cobranca/.test(norm)) tipo = 'Fatura'
  else if (/recibo|recibemos|recebi\b|rpa\b/.test(norm)) tipo = 'Recibo'
  else if (/\b(darf|das|darm|gps|gnre|gare)\b|guia de|tributo|taxa municipal/.test(norm)) tipo = 'Guia'

  const prestadorBlock = tipo === 'NFS-e' ? findSection(text, [/^\s*prestador(?:\s+de\s+servi\S*)?\s*:?\s*$/i, /^\s*dados\s+do\s+prestador/i], [/^\s*tomador\b/i, /^\s*intermediario\b/i, /^\s*discriminacao\b/i, /^\s*servicos\b/i, /^\s*valores\b/i]) : ''
  const linhaDigitavel = tipo === 'Boleto' ? findLinhaDigitavel(text) : ''
  const numero = ['NF-e', 'NFC-e', 'CT-e'].includes(tipo) && decoded?.numero ? decoded.numero : (findDocNumber(text, tipo) || decoded?.numero || '')
  const dataEmissao = findDateNear(lines, [/emiss/i, /compet/i, /data do documento/i]) || decoded?.date || ''
  const dataVenc = findDateNear(lines, [/venc/i, /pagar ate/i, /data limite/i])
  const cnpj = tipo === 'NFS-e' ? (firstCnpj(prestadorBlock) || '') : (firstCnpj(text) || decoded?.cnpj || '')
  const razao = findName(lines, tipo, prestadorBlock)
  const total = findValue(text, lines, tipo)
  const desc = findDescription(lines, tipo)

  return {
    tipo_documento: tipo,
    numero_nf: numero || null,
    serie: null,
    data_emissao: dataEmissao || null,
    data_vencimento: dataVenc || null,
    chave_acesso: chave || null,
    linha_digitavel: linhaDigitavel || null,
    codigo_barras: null,
    codigo_verificacao: null,
    emitente: { razao_social: cleanCompanyName(razao) || null, cnpj: cnpj || null },
    itens: desc ? [{ descricao: desc, quantidade: 1, unidade: ['NF-e', 'NFC-e'].includes(tipo) ? 'UN' : 'Srv', valor_unitario: total, valor_total: total }] : [],
    discriminacao: desc || null,
    valores: { subtotal: total, desconto: 0, frete: 0, valor_total: total },
    pagamento: { forma: tipo === 'Boleto' ? 'BOLETO' : 'A_VISTA', num_parcelas: 1, parcelas: [] },
    observacoes: null,
  }
}

function findLinhaDigitavel(text: string) {
  const m = text.match(/(?:linha digitavel|codigo de barras)[^\d]*(\d[\d .-]{30,80}\d)/i)
    || text.match(/\b(\d{5}\.?\d{5}\s+\d{5}\.?\d{6}\s+\d{5}\.?\d{6}\s+\d\s+\d{14})\b/)
  return m ? m[1].replace(/\s+/g, ' ').trim() : ''
}

function findDocNumberLegacy(text: string, tipo: string) {
  if (tipo === 'NFS-e') {
    const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean)
    for (let i = 0; i < lines.length; i++) {
      const line = stripAccents(lines[i])
      if (!/(numero|n[roºo.]|nota fiscal|nfs)/i.test(line)) continue
      const m = line.match(/(?:numero(?:\s+da\s+nota)?|n[roºo.]?\s*(?:da\s+nota)?|nota\s+fiscal(?:\s+de\s+servicos)?|nfs-?e)\s*:?\s*([0-9][0-9.\-/]{0,20})/i)
      if (m) return cleanStr(m[1]).replace(/[^\d.\-/]/g, '')
      const next = lines[i + 1] || ''
      if (/^\d{1,20}$/.test(next.replace(/\D/g, ''))) return next.replace(/\D/g, '')
    }
    return ''
  }
  const re = tipo === 'Boleto'
    ? /(?:nosso numero|documento|boleto)\s*:?\s*([A-Z0-9.\-/]{3,30})/i
    : /(?:numero|n(?:ro|o)?\.?|nf-?e|nfs-?e|nfc-?e|ct-?e|fatura|recibo|documento)\s*(?:da nota)?\s*:?\s*([A-Z0-9.\-/]{2,30})/i
  return cleanStr((text.match(re) || [])[1])
}

function findDocNumber(text: string, tipo: string) {
  if (tipo === 'Boleto') {
    return cleanStr((text.match(/(?:nosso numero|documento|boleto)\s*:?\s*([A-Z0-9.\-/]{3,30})/i) || [])[1])
  }

  const nfTipos = ['NF-e', 'NFC-e', 'NFS-e', 'CT-e']
  if (!nfTipos.includes(tipo)) {
    return cleanStr((text.match(/(?:numero|n(?:ro|o)?\.?|fatura|recibo|documento)\s*:?\s*([A-Z0-9.\-/]{2,30})/i) || [])[1])
  }

  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean)
  const skip = /codigo|verifica|autentic|rps|serie|cnpj|cpf|inscri|competencia|data|valor|aliquota|protocolo|chave/i
  const explicitNota = /nota\s*fiscal|nfs-?e|nf-?e|nfc-?e|ct-?e|numero\s*\/\s*serie|numero\s*(?:da\s*)?(?:nota|nota\s*fiscal)/i
  const label = tipo === 'NFS-e'
    ? /(?:numero\s*\/\s*serie|numero\s*(?:da\s*)?(?:nota|nfs-?e|nota\s*fiscal)|nota\s*fiscal\s*(?:de\s*servicos?)?|nfs-?e|n(?:ro|o|º)?\.?\s*(?:da\s*nota)?)/i
    : /(?:numero\s*\/\s*serie|numero\s*(?:da\s*)?(?:nota|nf-?e|nfc-?e|ct-?e|documento)|nf-?e|nfc-?e|ct-?e|nota\s*fiscal|n(?:ro|o|º)?\.?\s*(?:da\s*nota)?)/i

  for (let i = 0; i < lines.length; i++) {
    const line = stripAccents(lines[i])
    if (skip.test(line) && !explicitNota.test(line)) continue
    if (!label.test(line)) continue

    const same = line.match(/(?:numero\s*\/\s*serie|numero\s*(?:da\s*)?(?:nota\s*fiscal|nota|nf-?e|nfs-?e|nfc-?e|ct-?e)?|nota\s*fiscal(?:\s*de\s*servicos?)?|nfs-?e|nf-?e|nfc-?e|ct-?e|n(?:ro|o|º)?\.?\s*(?:da\s*nota)?)\s*(?:n(?:o|º)?\.?)?\s*[:#-]?\s*([0-9][0-9.\-/ ]{0,24})/i)
    if (same) {
      const n = normalizeInvoiceNumber(same[1], tipo)
      if (n) return n
    }

    const next = lines[i + 1] || ''
    if (/^[0-9][0-9.\-/ ]{0,24}$/.test(next)) {
      const n = normalizeInvoiceNumber(next, tipo)
      if (n) return n
    }
  }
  return ''
}

function findDateNear(lines: string[], labels: RegExp[]) {
  for (let i = 0; i < lines.length; i++) {
    if (!labels.some((re) => re.test(lines[i]))) continue
    for (let j = i; j <= Math.min(i + 3, lines.length - 1); j++) {
      const m = lines[j].match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/)
      if (m) return dateIso(m[1])
    }
  }
  return ''
}

function findValue(text: string, lines: string[], tipo: string) {
  const labels = [
    /valor total/i,
    /total da nota/i,
    /valor do documento/i,
    /valor a pagar/i,
    /valor cobrado/i,
    /valor liquido/i,
    /valor dos servicos/i,
  ]
  if (tipo === 'Boleto') labels.unshift(/valor do boleto/i)

  for (let i = 0; i < lines.length; i++) {
    if (!labels.some((re) => re.test(lines[i]))) continue
    for (let j = i; j <= Math.min(i + 4, lines.length - 1); j++) {
      const v = firstMoney(lines[j])
      if (v) return v
    }
  }

  return 0
}

function findName(lines: string[], tipo: string, trustedBlock = '') {
  if (tipo === 'NFS-e') {
    const blockLines = String(trustedBlock || '').split('\n').map((l) => l.trim()).filter(Boolean)
    const fromBlock = findNameInLines(blockLines, [/razao social/i, /nome empresarial/i, /nome\/razao social/i, /prestador/i])
    return fromBlock
  }
  const labels = tipo === 'Boleto'
    ? [/beneficiario/i, /cedente/i, /favorecido/i]
    : [/emitente/i, /fornecedor/i, /beneficiario/i, /razao social/i, /empresa prestadora/i]

  const anchored = findNameInLines(lines, labels)
  if (anchored) return anchored

  for (const line of lines) {
    const s = cleanStr(line)
    const norm = stripAccents(s).toLowerCase()
    if (s.length > 8 && s.length < 120 && /^[A-Z0-9 .&/-]+$/.test(stripAccents(s)) && s.split(/\s+/).length >= 2 && !/^(nota|nfs|nf-e|nfc|ct-e|prefeitura|recibo|boleto|fatura|cnpj|data|valor)/.test(norm)) return s
  }
  return ''
}

function findNameInLines(lines: string[], labels: RegExp[]) {
  for (let i = 0; i < lines.length; i++) {
    const norm = stripAccents(lines[i])
    const label = labels.find((re) => re.test(norm))
    if (!label) continue
    const same = cleanStr(lines[i].replace(label, '').replace(/[:\-]/g, ' '))
    if (isValidCompanyNameCandidate(same)) return same
    for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
      const next = cleanStr(lines[j] || '')
      const nextNorm = stripAccents(next).toLowerCase()
      if (isValidCompanyNameCandidate(next) && !/^(cnpj|cpf|endere|tel|fone|inscri|agencia|codigo|municipio|telefone|email)/i.test(nextNorm) && !/\d{2}\.\d{3}\.\d{3}/.test(next)) return next
    }
  }
  return ''
}

function isValidCompanyNameCandidate(raw: unknown) {
  const s = cleanStr(raw)
  const n = stripAccents(s).toLowerCase()
  if (s.length < 5 || /^\d/.test(s)) return false
  if (/^(de\s+)?servi|^prestador(?:\s+de\s+servi\S*)?$|^dados\s+do\s+prestador$|^razao\s+social$|^nome\s+empresarial$|^tomador/.test(n)) return false
  if (/cnpj|cpf|endere|telefone|email|municipio|inscricao|codigo/.test(n)) return false
  return true
}

function findSection(text: string, starts: RegExp[], ends: RegExp[]) {
  const lines = String(text || '').split('\n')
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    const n = stripAccents(lines[i])
    if (starts.some((re) => re.test(n))) {
      start = i
      break
    }
  }
  if (start < 0) return ''
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    const n = stripAccents(lines[i])
    if (ends.some((re) => re.test(n))) {
      end = i
      break
    }
  }
  return lines.slice(start, end).join('\n')
}

function findDescription(lines: string[], tipo: string) {
  const labels = [/discriminacao/i, /descricao/i, /historico/i, /referencia/i, /servico/i, /produto/i, /competencia/i]
  for (let i = 0; i < lines.length; i++) {
    if (!labels.some((re) => re.test(stripAccents(lines[i])))) continue
    const same = cleanStr(lines[i].replace(/^(discriminacao|descricao|historico|referencia|servico|produto|competencia)\s*:?\s*/i, ''))
    if (same.length > 6) return same
    const next = cleanStr(lines[i + 1] || '')
    if (next.length > 6) return next
  }
  return tipo === 'Boleto' ? 'Cobranca por boleto bancario' : ''
}

function decodeAccessKey(chave: string) {
  const c = onlyDigits(chave)
  if (c.length !== 44) return null
  const mod = c.slice(20, 22)
  const tipo = mod === '65' ? 'NFC-e' : mod === '57' ? 'CT-e' : 'NF-e'
  const yy = Number(c.slice(2, 4))
  const mm = c.slice(4, 6)
  const serie = String(Number(c.slice(22, 25)) || '')
  const numero = String(Number(c.slice(25, 34)) || '')
  return {
    tipo,
    mod,
    cnpj: formatCnpj(c.slice(6, 20)),
    serie,
    numero,
    date: `20${String(yy).padStart(2, '0')}-${mm}-01`,
  }
}

function parseJsonObject(text: string) {
  const cleaned = String(text || '').replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    if (start < 0) throw new Error('JSON nao encontrado na resposta')
    let depth = 0
    let inString = false
    let esc = false
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i]
      if (inString) {
        if (esc) esc = false
        else if (ch === '\\') esc = true
        else if (ch === '"') inString = false
      } else if (ch === '"') inString = true
      else if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1))
      }
    }
    throw new Error('JSON incompleto na resposta')
  }
}

function hasUsefulData(data: AnyRecord) {
  const total = num(data?.valores?.valor_total)
  return Boolean(data?.emitente?.razao_social || data?.emitente?.cnpj || data?.numero_nf || data?.chave_acesso || data?.linha_digitavel || total > 0 || data?.itens?.length)
}

function missingPaymentFields(data: AnyRecord | null) {
  const d = data || {}
  const emit = d.emitente || {}
  const valores = d.valores || {}
  const total = num(valores.valor_total)
  const missing: string[] = []
  if (isBlank(emit.razao_social)) missing.push('emitente/beneficiario')
  if (isBlank(emit.cnpj)) missing.push('CNPJ')
  if (!total) missing.push('valor total')
  if (isBlank(d.numero_nf) && isBlank(d.chave_acesso) && isBlank(d.linha_digitavel) && isBlank(d.codigo_barras) && isBlank(d.codigo_verificacao)) missing.push('numero/codigo do documento')
  if (isBlank(d.data_emissao) && isBlank(d.data_vencimento)) missing.push('data')
  if ((!Array.isArray(d.itens) || d.itens.length === 0) && isBlank(d.discriminacao)) missing.push('descricao/itens')
  return missing
}

function completenessScore(data: AnyRecord | null) {
  const required = 6
  return Math.max(0, required - missingPaymentFields(data).length)
}

function describeFoundFields(data: AnyRecord | null) {
  const d = data || {}
  const emit = d.emitente || {}
  const valores = d.valores || {}
  const found: string[] = []
  if (!isBlank(emit.razao_social)) found.push('emitente')
  if (!isBlank(emit.cnpj)) found.push('CNPJ')
  if (num(valores.valor_total)) found.push('valor')
  if (!isBlank(d.numero_nf) || !isBlank(d.chave_acesso) || !isBlank(d.linha_digitavel) || !isBlank(d.codigo_barras) || !isBlank(d.codigo_verificacao)) found.push('documento/codigo')
  if (!isBlank(d.data_emissao) || !isBlank(d.data_vencimento)) found.push('data')
  if ((Array.isArray(d.itens) && d.itens.length) || !isBlank(d.discriminacao)) found.push('descricao/itens')
  return found.length ? found.join(', ') : 'nenhum campo principal'
}

function enrichDataForReturn(data: AnyRecord | null, attempts: string[]) {
  const out: AnyRecord = JSON.parse(JSON.stringify(data || {}))
  const missing = missingPaymentFields(out)
  out._meta = {
    ...(out._meta || {}),
    completenessScore: completenessScore(out),
    completeForPayment: missing.length === 0,
    missingFields: missing,
    cascadeAttempts: attempts.length,
  }
  return out
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

function ok(data: AnyRecord, attempts: string[]) {
  const enriched = enrichDataForReturn(data, attempts)
  return json({
    ok: true,
    data: enriched,
    attempts,
    warnings: enriched._meta?.missingFields?.length ? ['Campos ainda nao encontrados: ' + enriched._meta.missingFields.join(', ')] : [],
  })
}

function json(payload: AnyRecord) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

function normalizeTipo(raw: unknown) {
  const s = stripAccents(String(raw || '')).toUpperCase().replace(/\s+/g, ' ')
  if (/NFC/.test(s) || /CUPOM/.test(s)) return 'NFC-e'
  if (/NFS|SERVICO/.test(s)) return 'NFS-e'
  if (/CTE|CT-E|TRANSPORTE/.test(s)) return 'CT-e'
  if (/BOLETO/.test(s)) return 'Boleto'
  if (/FATURA|INVOICE|COBRANCA|DEMONSTRATIVO/.test(s)) return 'Fatura'
  if (/RECIBO|RPA/.test(s)) return 'Recibo'
  if (/GUIA|DARF|DAS|GPS|GNRE|DARM|GARE|TRIBUTO|TAXA/.test(s)) return 'Guia'
  if (/OUTRO/.test(s)) return 'Outro'
  return 'NF-e'
}

function normalizeForma(raw: unknown) {
  const s = stripAccents(String(raw || '')).toUpperCase()
  if (/PARCEL/.test(s)) return 'PARCELADO'
  if (/BOLETO/.test(s)) return 'BOLETO'
  if (/PIX/.test(s)) return 'PIX'
  if (/CART|CRED|DEB/.test(s)) return 'CARTAO'
  if (/OUTRO/.test(s)) return 'OUTRO'
  return 'A_VISTA'
}

function normalizeInvoiceNumber(raw: unknown, tipo: string, chave?: unknown) {
  const key = onlyDigits(chave || '')
  if (['NF-e', 'NFC-e', 'CT-e'].includes(tipo) && key.length === 44) {
    const decoded = decodeAccessKey(key)
    if (decoded?.numero) return decoded.numero
  }

  const s = cleanStr(raw)
  if (!s) return ''

  const compact = onlyDigits(s)
  const embeddedKey = (compact.match(/\d{44}/) || [])[0] || ''
  if (['NF-e', 'NFC-e', 'CT-e'].includes(tipo) && embeddedKey) {
    const decoded = decodeAccessKey(embeddedKey)
    if (decoded?.numero) return decoded.numero
  }

  const noAccent = stripAccents(s)
  const m = noAccent.match(/(?:numero\s*\/\s*serie|numero\s*(?:da\s*)?(?:nota\s*fiscal|nota|nf-?e|nfs-?e|nfc-?e|ct-?e)?|nota\s*fiscal(?:\s*de\s*servicos)?|nfs-?e|nf-?e|nfc-?e|ct-?e|n(?:ro|o|º)?\.?)\s*(?:n(?:o|º)?\.?)?\s*[:#-]?\s*([0-9][0-9.\-/ ]{0,24})/i)
  let candidate = m ? m[1] : s
  const seriePair = String(candidate).match(/^\s*([0-9][0-9. ]*)\s*\/\s*\d{1,3}\s*$/)
  if (seriePair) candidate = seriePair[1]
  const beforeNoise = String(candidate).split(/\b(?:serie|codigo|verificacao|rps|cnpj|cpf|inscricao|competencia|data|valor|protocolo|chave)\b/i)[0]
  const digits = onlyDigits(beforeNoise)
  return digits ? digits.replace(/^0+(?=\d)/, '') : ''
}

function dateIso(raw: unknown) {
  const s = cleanStr(raw)
  if (!s) return null
  const iso = s.match(/\d{4}-\d{2}-\d{2}/)
  if (iso) return iso[0]
  const br = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (!br) return null
  const year = br[3].length === 2 ? '20' + br[3] : br[3]
  return `${year}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
}

function firstMoney(s: string) {
  const m = String(s || '').match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})/)
  return m ? num(m[1]) : 0
}

function num(raw: unknown) {
  if (raw == null || raw === '') return 0
  if (typeof raw === 'number') return Number.isFinite(raw) ? round2(raw) : 0
  let s = String(raw).replace(/[^\d,.-]/g, '').trim()
  if (!s) return 0
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) s = s.replace(/\./g, '').replace(',', '.')
  else if (hasComma) s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? round2(n) : 0
}

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function sumItems(items: AnyRecord[]) {
  return round2((items || []).reduce((acc, it) => acc + num(it.valor_total), 0))
}

function cleanStr(raw: unknown) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim()
}

function cleanCompanyName(raw: unknown) {
  return cleanStr(raw)
    .replace(/^(?:raz\S*o\s+social|nome\s+empresarial|nome\s*\/\s*raz\S*o\s+social)\s*:?\s*/i, '')
    .replace(/^prestador\s*:\s*/i, '')
    .replace(/^prestador\s+de\s+servi\S*\s*:?\s*/i, '')
    .replace(/^(?:cnpj|cpf|cpf\s*\/\s*cnpj)\s*:?\s*[0-9.\-/ ]+/i, '')
    .trim()
}

function onlyDigits(raw: unknown) {
  return String(raw ?? '').replace(/\D/g, '')
}

function firstCnpj(text: string) {
  const formatted = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)
  if (formatted) return formatted[0]
  const raw = text.match(/(?:CNPJ|CPF\/CNPJ)[^\d]*(\d[\d.\-/ ]{12,20}\d)/i)
  return raw ? formatCnpj(raw[1]) : ''
}

function formatCnpj(raw: unknown) {
  const d = onlyDigits(raw)
  if (d.length !== 14) return cleanStr(raw)
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function stripAccents(raw: string) {
  return String(raw || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
