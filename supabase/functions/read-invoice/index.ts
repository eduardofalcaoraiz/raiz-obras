// Supabase Edge Function: read-invoice (v5 — extração profunda de itens/materiais)
//
// DEPLOY:
//   1. Supabase Dashboard → Edge Functions → "read-invoice" → editar código → Deploy
//   2. Settings → Edge Functions → Secrets → GROQ_API_KEY = <chave do console.groq.com>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROMPT = `Você é especialista em documentos fiscais brasileiros e materiais de construção civil. Analise esta imagem com máxima atenção e extraia TODOS os dados visíveis.

━━ NF-e / DANFE (Nota Fiscal de Produtos) ━━
• emitente.razao_social → seção "IDENTIFICAÇÃO DO EMITENTE": nome completo da empresa emissora
• emitente.cnpj → CNPJ do EMITENTE (não do destinatário), formato XX.XXX.XXX/XXXX-XX
• numero_nf → campo "Nº" no cabeçalho
• serie → campo "SÉRIE"
• data_emissao → campo "DATA DE EMISSÃO"
• chave_acesso → 44 dígitos IMPRESSOS EM TEXTO sob o código de barras (não decodifique o gráfico)
• itens → EXTRAIA TODOS OS ITENS DA TABELA DE PRODUTOS:
  - descricao: nome COMPLETO e EXATO do produto (preserve especificações técnicas: "Concreto usinado FCK 25 MPa", "Aço CA-50 ⌀10mm", "Piso porcelanato 60x60 polido")
  - quantidade: número decimal (use ponto: 30.5)
  - unidade: unidade ORIGINAL da nota (M3, KG, M2, UN, SC, TON, M, L, etc.)
  - valor_unitario: preço unitário decimal
  - valor_total: total do item decimal
  ATENÇÃO: itens de materiais de construção SEMPRE têm especificações técnicas — preserve-as integralmente para permitir classificação posterior. Exemplos: "CIMENTO PORTLAND CP-II 50KG", "TIJOLO CERAMICO 9X14X19", "AREIA LAVADA GROSSA", "VERGALHAO CA-50 D=12.5MM"
• valores.subtotal → "TOTAL DOS PRODUTOS"
• valores.desconto → "DESCONTO"
• valores.frete → "FRETE"
• valores.valor_total → "VALOR TOTAL DA NOTA"
• pagamento.forma → "A_VISTA" ou "PARCELADO"
• pagamento.num_parcelas → número de parcelas
• pagamento.parcelas → [{numero, valor, vencimento}]

━━ NFS-e / DANFSE (Nota Fiscal de Serviços) ━━
• emitente.razao_social → seção "PRESTADOR DE SERVIÇOS"
• emitente.cnpj → CNPJ do PRESTADOR (não do tomador)
• numero_nf → "Nº DA NFS-e"
• data_emissao → data de emissão ou competência
• chave_acesso → código de verificação alfanumérico
• discriminacao → texto COMPLETO da discriminação dos serviços (copie todo o texto)
• valores.valor_total → "VALOR DOS SERVIÇOS" ou "VALOR LÍQUIDO"
• pagamento.forma → forma de pagamento se informada

━━ REGRAS OBRIGATÓRIAS ━━
1. Nunca confunda EMITENTE/PRESTADOR com DESTINATÁRIO/TOMADOR
2. chave_acesso: leia o número impresso em texto, NUNCA o código de barras gráfico
3. Todos os valores: números decimais puros (sem R$, sem pontos de milhar, vírgula vira ponto)
4. datas: formato YYYY-MM-DD
5. Para itens de materiais: PRESERVAR especificações técnicas completas na descrição
6. Campos não encontrados: null
7. Extraia TODOS os itens visíveis — nunca truncar a lista

Retorne APENAS este JSON (sem markdown):
{
  "tipo_documento": "NF-e ou NFS-e",
  "numero_nf": "dígitos",
  "serie": null,
  "data_emissao": "YYYY-MM-DD",
  "chave_acesso": "44 dígitos ou código de verificação",
  "emitente": {"razao_social": "nome completo", "cnpj": "XX.XXX.XXX/XXXX-XX"},
  "itens": [{"descricao": "nome técnico completo", "quantidade": 1, "unidade": "UN", "valor_unitario": 0.00, "valor_total": 0.00}],
  "discriminacao": "texto dos serviços para NFS-e",
  "valores": {"subtotal": 0.00, "desconto": 0.00, "frete": 0.00, "valor_total": 0.00},
  "pagamento": {"forma": "A_VISTA", "num_parcelas": 1, "parcelas": []},
  "observacoes": ""
}`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { imageBase64, mediaType } = await req.json()
    if (!imageBase64) throw new Error('Imagem não recebida (imageBase64 ausente)')

    const GROQ_KEY = Deno.env.get('GROQ_API_KEY')
    if (!GROQ_KEY) throw new Error('Secret GROQ_API_KEY não configurado no Supabase')

    const imgMediaType = mediaType || 'image/jpeg'

    let groqResp: Response
    try {
      groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + GROQ_KEY,
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${imgMediaType};base64,${imageBase64}` } },
              { type: 'text', text: PROMPT },
            ],
          }],
          max_tokens: 2500,
          temperature: 0,
        }),
      })
    } catch (e) {
      throw new Error('Erro de rede ao chamar Groq: ' + (e as Error).message)
    }

    if (!groqResp.ok) {
      let msg = `Groq HTTP ${groqResp.status}`
      try { const j = await groqResp.json(); msg = j.error?.message || msg } catch {}
      throw new Error(msg)
    }

    const groqData = await groqResp.json()
    const text = (groqData.choices?.[0]?.message?.content ?? '').trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('IA não retornou JSON válido: ' + text.slice(0, 120))

    let extracted: Record<string, unknown>
    try { extracted = JSON.parse(jsonMatch[0]) }
    catch { throw new Error('Falha ao parsear JSON da IA') }

    return new Response(JSON.stringify({ ok: true, data: extracted }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
