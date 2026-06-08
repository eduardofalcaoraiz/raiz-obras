import urllib.request, json, sys, base64, time, urllib.parse
sys.stdout.reconfigure(encoding='utf-8')

ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqY2N4Znpub2pqb3N2YW53enR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NzQ0MzUsImV4cCI6MjA5NTQ1MDQzNX0.sdOyn4CdxhSAb_6G6TdUwd5Yv3diQEuTbNoay7uHko8'
BASE='https://hjccxfznojjosvanwztv.supabase.co'
GEMINI_KEY = 'COLOQUE_SUA_CHAVE_GEMINI_AQUI'  # obter em aistudio.google.com
GEMINI_URL=f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_KEY}'

PROMPT="""Você é especialista em documentos fiscais brasileiros. Analise este PDF com máxima atenção.

EXTRAIA TODOS OS DADOS:

Para NF-e (Nota Fiscal de Produtos/Materiais):
- emitente.razao_social: nome completo do EMITENTE (não do destinatário)
- emitente.cnpj: CNPJ do emitente XX.XXX.XXX/XXXX-XX
- numero_nf: número da nota
- data_emissao: YYYY-MM-DD
- chave_acesso: 44 dígitos
- TODOS os itens da tabela de produtos (pode ter muitos):
  - descricao: nome completo do produto com especificações técnicas
  - quantidade: número decimal com ponto
  - unidade: unidade original (UN, CX, KG, M2, M3, L, PC, etc.)
  - valor_unitario: valor unitário decimal
  - valor_total: valor total do item decimal
- valores.subtotal, valores.desconto, valores.frete, valores.valor_total

Para NFS-e (Nota Fiscal de Serviços):
- emitente.razao_social: nome do PRESTADOR
- emitente.cnpj: CNPJ do prestador
- numero_nf, data_emissao
- discriminacao: COPIAR EXATAMENTE o texto completo de discriminação dos serviços
- valores.valor_total

REGRAS:
1. Extraia TODOS os itens — nunca corte ou omita nenhum
2. Valores sem R$, sem pontos de milhar, vírgula vira ponto (ex: 1.500,00 → 1500.00)
3. Campos não encontrados: null
4. Retorne APENAS JSON válido sem markdown nem texto extra

{
  "tipo_documento": "NF-e ou NFS-e",
  "numero_nf": null,
  "data_emissao": null,
  "emitente": {"razao_social": null, "cnpj": null},
  "itens": [{"descricao": "", "quantidade": 1, "unidade": "UN", "valor_unitario": 0, "valor_total": 0}],
  "discriminacao": null,
  "valores": {"subtotal": 0, "desconto": 0, "frete": 0, "valor_total": 0}
}"""

def download_pdf(path):
    enc=urllib.parse.quote(path, safe='/')
    url=f'{BASE}/storage/v1/object/public/pagamentos/{enc}'
    req=urllib.request.Request(url,headers={'Authorization':f'Bearer {ANON}','apikey':ANON})
    with urllib.request.urlopen(req,timeout=20) as r:
        return r.read()

def read_with_gemini(pdf_bytes):
    pdf_b64=base64.b64encode(pdf_bytes).decode()
    body=json.dumps({
        'contents':[{'parts':[
            {'inlineData':{'mimeType':'application/pdf','data':pdf_b64}},
            {'text':PROMPT}
        ]}],
        'generationConfig':{'maxOutputTokens':8192,'temperature':0}
    }).encode()
    req=urllib.request.Request(GEMINI_URL,data=body,headers={'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(req,timeout=60) as r:
        resp=json.loads(r.read())
    text=resp.get('candidates',[{}])[0].get('content',{}).get('parts',[{}])[0].get('text','')
    m=__import__('re').search(r'\{[\s\S]*\}',text)
    if not m: raise ValueError(f'Sem JSON: {text[:100]}')
    return json.loads(m.group(0))

def update_payment(pid, updates):
    body=json.dumps(updates).encode()
    req=urllib.request.Request(
        f'{BASE}/rest/v1/pagamentos?id=eq.{pid}',
        data=body, method='PATCH',
        headers={'Authorization':f'Bearer {ANON}','apikey':ANON,
                 'Content-Type':'application/json','Prefer':'return=minimal'}
    )
    with urllib.request.urlopen(req,timeout=15) as r:
        return r.status

# Buscar pagamentos com NF
req=urllib.request.Request(
    BASE+'/rest/v1/pagamentos?nf_doc_path=neq.&select=id,obra_id,ben,nf_doc_path,nf_tipo,v,itens_pag,nf_num,obs&order=id.desc',
    headers={'Authorization':f'Bearer {ANON}','apikey':ANON,'Accept':'application/json'}
)
with urllib.request.urlopen(req) as r:
    pags=json.loads(r.read())

print(f'Processando {len(pags)} pagamentos com NF...\n')

ok=0; erros=0
for p in pags:
    pid=p['id']; ben=p['ben'][:30]; path=p['nf_doc_path']
    tem_itens=p.get('itens_pag') and len(p['itens_pag'])>0
    nf_tipo=p.get('nf_tipo','')

    print(f'[{pid}] {ben}')

    try:
        # Download PDF
        pdf=download_pdf(path)
        print(f'  PDF: {len(pdf)} bytes')

        # Ler com Gemini
        data=read_with_gemini(pdf)

        # Preparar updates
        updates={}

        # Itens de material (NF-e)
        if data.get('itens') and len(data['itens'])>0:
            # Filtrar itens válidos
            itens=[it for it in data['itens'] if it.get('descricao')]
            if itens:
                updates['itens_pag']=itens
                print(f'  Itens: {len(itens)} extraídos')

        # Discriminação de serviço (NFS-e) — criar 1 item com a discriminação
        elif data.get('discriminacao') and nf_tipo=='NFS-e':
            disc=data['discriminacao'].strip()
            if disc:
                item_svc=[{
                    'descricao':disc,
                    'quantidade':1,
                    'unidade':'Srv',
                    'valor_unitario':float(data.get('valores',{}).get('valor_total') or p['v']),
                    'valor_total':float(data.get('valores',{}).get('valor_total') or p['v'])
                }]
                updates['itens_pag']=item_svc
                print(f'  Discriminação: {disc[:80]}...' if len(disc)>80 else f'  Discriminação: {disc}')

        # CNPJ emitente → obs se não tiver
        if data.get('emitente',{}).get('cnpj') and not p.get('obs'):
            cnpj=data['emitente']['cnpj']
            nome=data['emitente'].get('razao_social','')
            updates['obs']=f'CNPJ emitente: {cnpj}' + (f' | {nome}' if nome else '')

        if updates:
            st=update_payment(pid,updates)
            print(f'  Atualizado: {list(updates.keys())}')
            ok+=1
        else:
            print(f'  Sem dados novos para atualizar')

    except Exception as e:
        print(f'  ERRO: {e}')
        erros+=1

    time.sleep(1.5)  # respeitar rate limit Gemini
    print()

print(f'\nFinalizado: {ok} atualizados, {erros} erros')
