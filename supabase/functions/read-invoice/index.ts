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

Issuer/provider self-check:
- NF-e/NFC-e/CT-e: emitente is the company in EMITENTE/REMETENTE, never DESTINATARIO.
- NFS-e: emitente is PRESTADOR DE SERVICOS, never TOMADOR DE SERVICOS, CONTRATANTE, DESTINATARIO, INTERMEDIARIO, PAGADOR or the school/project owner.
- Boleto: emitente is BENEFICIARIO/CEDENTE/FAVORECIDO, never SACADO/PAGADOR.
- If both provider and taker appear, fill emitente with provider and tomador with taker. Do not copy tomador into emitente.
- For NFS-e, numero_nf is the Nota Fiscal/NFS-e number only. Put verification code in codigo_verificacao, not in numero_nf.

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

The input below is OCR/raw text extracted from the document. Preserve all useful details and return only the same JSON shape.`

type AnyRecord = Record<string, any>

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()
    const imageBase64 = String(body?.imageBase64 || '')
    const mediaType = String(body?.mediaType || 'application/pdf')
    if (!imageBase64) throw new Error('imageBase64 ausente')

    const attempts: string[] = []
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''

    if (geminiKey) {
      try {
        const raw = await callGeminiDocument(geminiKey, imageBase64, mediaType)
        const normalized = normalizeData(raw, 'gemini-direct')
        if (hasUsefulData(normalized)) return ok(normalized, attempts)
        attempts.push('Gemini direto retornou poucos dados uteis')
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
        if (hasUsefulData(normalized)) return ok(normalized, attempts)
        attempts.push('Mistral OCR retornou poucos dados uteis')
      } catch (err) {
        attempts.push('Mistral OCR: ' + errorMessage(err))
      }
    }

    const ocrSpaceKey = Deno.env.get('OCR_SPACE_API_KEY') || ''
    if (ocrSpaceKey) {
      try {
        const text = await callOcrSpace(ocrSpaceKey, imageBase64, mediaType)
        const normalized = await extractFromOcrText(text, geminiKey, 'ocr-space')
        if (hasUsefulData(normalized)) return ok(normalized, attempts)
        attempts.push('OCR.space retornou poucos dados uteis')
      } catch (err) {
        attempts.push('OCR.space: ' + errorMessage(err))
      }
    }

    throw new Error('Nao foi possivel extrair dados suficientes. Tentativas: ' + attempts.join(' | '))
  } catch (err) {
    return json({ ok: false, error: errorMessage(err) })
  }
})

async function extractFromOcrText(text: string, geminiKey: string, source: string) {
  if (!text.trim()) throw new Error('OCR sem texto extraido')

  if (geminiKey) {
    try {
      const raw = await callGeminiText(geminiKey, text)
      const normalized = normalizeData(raw, source + '+gemini')
      if (hasUsefulData(normalized)) return normalized
    } catch {
      // The heuristic below still gives a usable manual review draft.
    }
  }

  return normalizeData(extractHeuristic(text), source + '+heuristic')
}

async function callGeminiDocument(key: string, imageBase64: string, mediaType: string) {
  const parts = [
    { inlineData: { mimeType: mediaType || 'application/pdf', data: imageBase64 } },
    { text: DOCUMENT_PROMPT },
  ]
  return callGemini(key, parts, 'document')
}

async function callGeminiText(key: string, text: string) {
  const safeText = text.slice(0, 90000)
  const parts = [{ text: TEXT_PROMPT + '\n\nOCR_TEXT:\n' + safeText }]
  return callGemini(key, parts, 'text')
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
              maxOutputTokens: 8192,
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
  const emit = input?.emitente || input?.prestador || input?.beneficiario || {}
  const valores = input?.valores || {}
  const pagamento = input?.pagamento || {}
  const tipo = normalizeTipo(input?.tipo_documento || input?.tipo || input?.document_type)
  const total = num(valores.valor_total ?? input.valor_total ?? input.total ?? input.valor)
  const subtotal = num(valores.subtotal ?? valores.valor_servicos ?? input.subtotal) || total
  const desconto = num(valores.desconto ?? input.desconto)
  const frete = num(valores.frete ?? input.frete)
  const itens = normalizeItems(input?.itens || input?.items || [], tipo, total)
  const numero = cleanStr(input?.numero_nf ?? input?.numero ?? input?.numero_documento)
  const serie = cleanStr(input?.serie)
  const chave = cleanStr(input?.chave_acesso || input?.chave || '')
  const linha = cleanStr(input?.linha_digitavel || '')
  const barcode = cleanStr(input?.codigo_barras || '')
  const codVer = cleanStr(input?.codigo_verificacao || '')

  return {
    tipo_documento: tipo,
    numero_nf: numero || null,
    serie: serie || null,
    data_emissao: dateIso(input?.data_emissao || input?.emissao || input?.date),
    data_vencimento: dateIso(input?.data_vencimento || input?.vencimento || pagamento?.vencimento),
    chave_acesso: onlyDigits(chave).length === 44 ? onlyDigits(chave) : (tipo === 'NFS-e' ? null : chave || null),
    linha_digitavel: linha || null,
    codigo_barras: barcode || null,
    codigo_verificacao: codVer || (tipo === 'NFS-e' && chave ? chave : null),
    emitente: {
      razao_social: cleanStr(emit.razao_social || emit.nome || input.razao_social || input.ben || input.beneficiario) || null,
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
  }).filter(Boolean).slice(0, 120)
}

function normalizeParcelas(items: AnyRecord[], total: number) {
  if (!Array.isArray(items)) return []
  return items.map((p, idx) => ({
    numero: Number(p?.numero || p?.n || idx + 1) || idx + 1,
    valor: num(p?.valor) || (items.length ? round2(total / items.length) : 0),
    vencimento: dateIso(p?.vencimento || p?.data),
  })).filter((p) => p.valor || p.vencimento)
}

function extractHeuristic(rawText: string) {
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

  const linhaDigitavel = tipo === 'Boleto' ? findLinhaDigitavel(text) : ''
  const numero = findDocNumber(text, tipo) || decoded?.numero || ''
  const dataEmissao = findDateNear(lines, [/emiss/i, /compet/i, /data do documento/i]) || decoded?.date || ''
  const dataVenc = findDateNear(lines, [/venc/i, /pagar ate/i, /data limite/i])
  const cnpj = firstCnpj(text) || decoded?.cnpj || ''
  const razao = findName(lines, tipo)
  const total = findValue(text, lines, tipo)
  const desc = findDescription(lines, tipo)

  return {
    tipo_documento: tipo,
    numero_nf: numero || null,
    serie: decoded?.serie || null,
    data_emissao: dataEmissao || null,
    data_vencimento: dataVenc || null,
    chave_acesso: chave || null,
    linha_digitavel: linhaDigitavel || null,
    codigo_barras: null,
    codigo_verificacao: null,
    emitente: { razao_social: razao || null, cnpj: cnpj || null },
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

function findDocNumber(text: string, tipo: string) {
  const re = tipo === 'Boleto'
    ? /(?:nosso numero|documento|boleto)\s*:?\s*([A-Z0-9.\-/]{3,30})/i
    : /(?:numero|n(?:ro|o)?\.?|nf-?e|nfs-?e|nfc-?e|ct-?e|fatura|recibo|documento)\s*(?:da nota)?\s*:?\s*([A-Z0-9.\-/]{2,30})/i
  return cleanStr((text.match(re) || [])[1])
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

  const all = [...text.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})/g)]
    .map((m) => num(m[1]))
    .filter((v) => v > 0)
  return all.length ? Math.max(...all) : 0
}

function findName(lines: string[], tipo: string) {
  const labels = tipo === 'Boleto'
    ? [/beneficiario/i, /cedente/i, /favorecido/i]
    : tipo === 'NFS-e'
      ? [/prestador/i, /razao social/i]
      : [/emitente/i, /fornecedor/i, /beneficiario/i, /razao social/i, /empresa prestadora/i]

  for (let i = 0; i < lines.length; i++) {
    const norm = stripAccents(lines[i])
    const label = labels.find((re) => re.test(norm))
    if (!label) continue
    const same = cleanStr(lines[i].replace(label, '').replace(/[:\-]/g, ' '))
    if (same.length > 4 && !/^\d/.test(same) && !/cnpj|cpf/i.test(same)) return same
    const next = cleanStr(lines[i + 1] || '')
    if (next.length > 4 && !/^(cnpj|cpf|endere|tel|fone|inscri|agencia|codigo)/i.test(stripAccents(next))) return next
  }

  for (const line of lines) {
    const s = cleanStr(line)
    const norm = stripAccents(s).toLowerCase()
    if (s.length > 8 && s.length < 120 && /^[A-Z0-9 .&/-]+$/.test(stripAccents(s)) && s.split(/\s+/).length >= 2 && !/^(nota|nfs|nf-e|nfc|ct-e|prefeitura|recibo|boleto|fatura|cnpj|data|valor)/.test(norm)) return s
  }
  return ''
}

function findDescription(lines: string[], tipo: string) {
  const labels = [/discriminacao/i, /descricao/i, /historico/i, /referencia/i, /servico/i, /produto/i, /competencia/i]
  for (let i = 0; i < lines.length; i++) {
    if (!labels.some((re) => re.test(stripAccents(lines[i])))) continue
    const same = cleanStr(lines[i].replace(/^(discriminacao|descricao|historico|referencia|servico|produto|competencia)\s*:?\s*/i, ''))
    if (same.length > 6) return same.slice(0, 800)
    const next = cleanStr(lines[i + 1] || '')
    if (next.length > 6) return next.slice(0, 800)
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
  return json({ ok: true, data, attempts })
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
