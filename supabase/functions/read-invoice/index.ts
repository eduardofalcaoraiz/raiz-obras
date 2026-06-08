// Supabase Edge Function: read-invoice (v8 — Gemini 2.5 Flash + Prompt Maximizado)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROMPT = `Você é especialista em documentos fiscais brasileiros (NF-e, NFS-e, NFC-e, DANFE, DANFSE). Analise com máxima atenção e extraia TODOS os dados.

━━ NF-e / DANFE (Nota Fiscal de Produtos) ━━
• emitente.razao_social → seção IDENTIFICAÇÃO DO EMITENTE: nome COMPLETO da empresa EMITENTE (NÃO do destinatário)
• emitente.cnpj → CNPJ do EMITENTE formato XX.XXX.XXX/XXXX-XX (NÃO do destinatário)
• numero_nf → campo Nº no cabeçalho (apenas números)
• serie → campo SÉRIE
• data_emissao → DATA DE EMISSÃO formato YYYY-MM-DD
• chave_acesso → 44 DÍGITOS impressos em texto (NÃO decodifique o código de barras)
• itens → EXTRAIA ABSOLUTAMENTE TODOS OS ITENS DA TABELA DE PRODUTOS:
  - descricao: nome COMPLETO com especificações técnicas (ex: CONCRETO USINADO FCK 25 MPa BOMBEADO, AÇO CA-50 D12.5mm)
  - quantidade: número decimal com ponto como separador
  - unidade: unidade ORIGINAL da nota (M3, KG, M2, UN, SC, TON, M, L, CX, PCT, etc.)
  - valor_unitario: preço unitário decimal
  - valor_total: total do item decimal
• valores.subtotal, valores.desconto, valores.frete, valores.valor_total
• pagamento.forma: A_VISTA, PARCELADO, BOLETO, PIX ou CARTAO
• pagamento.num_parcelas, pagamento.parcelas

━━ NFS-e / DANFSE (Nota Fiscal de Serviços) ━━
• emitente.razao_social → PRESTADOR DE SERVIÇOS (NÃO tomador)
• emitente.cnpj → CNPJ do PRESTADOR
• numero_nf, data_emissao formato YYYY-MM-DD
• chave_acesso → código de verificação alfanumérico
• discriminacao → COPIAR INTEGRALMENTE o texto de DISCRIMINAÇÃO DOS SERVIÇOS
• valores.valor_total

━━ DOCUMENTO ESCANEADO / FOTO ━━
Use OCR completo. Leia todos os campos visíveis mesmo com qualidade baixa.

━━ REGRAS ABSOLUTAS ━━
1. NUNCA confunda EMITENTE/PRESTADOR com DESTINATÁRIO/TOMADOR
2. chave_acesso: LEIA o número impresso em TEXT (44 dígitos)
3. Valores: APENAS decimais puros sem R$ sem pontos de milhar
4. Datas: SEMPRE YYYY-MM-DD
5. Extraia TODOS os itens, nunca truncar
6. Campos não encontrados: null
7. Retorne APENAS JSON válido sem markdown

{tipo_documento:NF-e,numero_nf:null,serie:null,data_emissao:null,chave_acesso:null,emitente:{razao_social:null,cnpj:null},itens:[{descricao:,quantidade:1,unidade:UN,valor_unitario:0.00,valor_total:0.00}],discriminacao:null,valores:{subtotal:0.00,desconto:0.00,frete:0.00,valor_total:0.00},pagamento:{forma:A_VISTA,num_parcelas:1,parcelas:[]},observacoes:null}`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()
    const { imageBase64, mediaType } = body
    if (!imageBase64) throw new Error('imageBase64 ausente')

    const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_KEY) throw new Error('Secret GEMINI_API_KEY nao configurado')

    const geminiBody = {
      contents: [{
        parts: [
          { inlineData: { mimeType: mediaType || 'application/pdf', data: imageBase64 } },
          { text: PROMPT }
        ]
      }],
      generationConfig: { maxOutputTokens: 8192, temperature: 0 }
    }

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) }
    )

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`Gemini ${resp.status}: ${err.slice(0, 200)}`)
    }

    const data = await resp.json()
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!text) throw new Error('Gemini retornou resposta vazia')

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('JSON nao encontrado na resposta')

    const extracted = JSON.parse(match[0])
    return new Response(JSON.stringify({ ok: true, data: extracted }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
