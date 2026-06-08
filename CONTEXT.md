# RAIZ OBRAS — Guia Completo de Contexto do Projeto

> **Este arquivo é a memória persistente do projeto.** Se você for um AI assistant novo (Codex, Gemini, etc.), leia tudo aqui antes de tocar em qualquer código. Cada seção documenta decisões reais que já custaram horas de debug.

---

## 1. Visão Geral

**Plataforma:** "Raiz Educação · Gestão de Obras e Documentos"  
**Propósito:** Sistema interno de gestão financeira de obras (CAPEX) e documentação de unidades escolares do grupo Raiz Educação.  
**Usuário principal:** Eduardo Falcão — gestor de obras/imóveis do grupo.  
**Comunicação:** Português (pt-BR).

**URLs de produção:**
- App: https://raiz-obras.vercel.app
- Repositório: https://github.com/eduardofalcaoraiz/raiz-obras (público)
- Supabase project ID: `hjccxfznojjosvanwztv` (região São Paulo)

---

## 2. Stack e Arquitetura

- **Frontend:** Single-file HTML — `index.html` hospedado no Vercel (auto-deploy via GitHub)
- **Banco:** Supabase (PostgreSQL + Auth + Storage)
- **Edge Functions:** Supabase Edge Functions (Deno) — leitura de NF via IA
- **Sem frameworks:** HTML/CSS/JS puro, zero build tools, zero npm
- **Bibliotecas CDN:**
  - `@supabase/supabase-js@2` — cliente Supabase
  - `xlsx-0.20.3` (SheetJS) — exportação Excel
  - `pdf.js@3.11.174` — renderização de PDFs inline

---

## 3. Arquivos Locais

```
C:\Users\eduardo.falcao\claude\raiz_obras\
├── raiz_index.html          ← ARQUIVO DE TRABALHO (editar aqui)
├── index.html               ← arquivo de deploy (copiar de raiz_index.html antes de publicar)
├── pre_deploy_check.py      ← verificação obrigatória antes de deploy
├── edge_function_read_invoice.ts  ← Edge Function leitura de NF
├── batch_read_nfs.py        ← batch de leitura de NFs existentes via Gemini
├── .github_token            ← GitHub PAT (escopo repo, sem expiração)
├── .supabase_token          ← Supabase Management API token
├── supabase_cli\supabase.exe  ← CLI do Supabase para deploy e SQL
├── supabase\.temp\project-ref ← projeto linkado: hjccxfznojjosvanwztv
├── logos\                   ← logos das marcas (PNG)
└── *.sql                    ← scripts SQL de setup
```

**Workflow de arquivos (CRÍTICO para entender):**
- `raiz_index.html` = arquivo de **trabalho** local. Eduardo edita sempre aqui.
- `index.html` = arquivo de **deploy**. Cópia idêntica do raiz_index.html, publicada no GitHub → Vercel.
- **No GitHub só existe `index.html`.** Se você é um AI externo (Codex, etc.) e vai editar pelo GitHub, edite diretamente `index.html` — é o mesmo arquivo.
- Antes de qualquer deploy: copiar `raiz_index.html` → `index.html` e rodar `scripts/pre_deploy_check.py`.

---

## 3b. Estrutura do Repositório GitHub

```
https://github.com/eduardofalcaoraiz/raiz-obras/
├── index.html                              ← app completo (single-file)
├── CONTEXT.md                              ← este arquivo (memória do projeto)
├── README.md
├── LOGO DA *.png                           ← logos das marcas
├── scripts/
│   ├── pre_deploy_check.py                 ← verificação obrigatória pré-deploy
│   └── batch_read_nfs.py                   ← batch leitura de NFs via Gemini
├── supabase/
│   └── functions/
│       └── read-invoice/
│           └── index.ts                    ← Edge Function leitura de NF
└── sql/
    ├── auth_setup.sql                      ← trigger + policies (rodar 1x)
    ├── auth_setup_patch.sql                ← correção de policies RLS
    ├── capex_E_marca.sql                   ← adiciona coluna marca em capex_itens
    ├── nossas_escolas_A.sql                ← insert das 48 escolas
    ├── nossas_escolas_B.sql                ← normaliza nomes de unidades
    └── update_escolas.sql                  ← CNPJs e endereços das escolas
```

---

## 4. Deploy (100% Automatizado)

### 4.1 Publicar index.html → GitHub → Vercel

```python
import base64, json, urllib.request

with open('C:/Users/eduardo.falcao/claude/raiz_obras/index.html', 'rb') as f:
    content = base64.b64encode(f.read()).decode('utf-8')

token = open('C:/Users/eduardo.falcao/claude/raiz_obras/.github_token').read().strip()

# Buscar SHA atual
req = urllib.request.Request('https://api.github.com/repos/eduardofalcaoraiz/raiz-obras/contents/index.html')
req.add_header('Authorization', 'token ' + token)
with urllib.request.urlopen(req) as r:
    sha = json.load(r)['sha']

# Publicar
payload = json.dumps({'message': 'deploy: descricao simples', 'content': content, 'sha': sha}).encode('utf-8')
req2 = urllib.request.Request(
    'https://api.github.com/repos/eduardofalcaoraiz/raiz-obras/contents/index.html',
    data=payload, method='PUT'
)
req2.add_header('Authorization', 'token ' + token)
req2.add_header('Content-Type', 'application/json')
with urllib.request.urlopen(req2) as resp:
    print(resp.status)  # 200 = atualizado
```

**ATENÇÃO:** Commit messages com caracteres especiais (acentos, emoji) causam JSON 400. Usar apenas ASCII simples.

### 4.2 Publicar Edge Function

```powershell
$env:SUPABASE_ACCESS_TOKEN = (Get-Content "C:\Users\eduardo.falcao\claude\raiz_obras\.supabase_token")
Set-Location "C:\Users\eduardo.falcao\claude\raiz_obras"
Copy-Item ".\edge_function_read_invoice.ts" ".\supabase\functions\read-invoice\index.ts" -Force
& ".\supabase_cli\supabase.exe" functions deploy read-invoice --project-ref hjccxfznojjosvanwztv --no-verify-jwt
```

### 4.3 Executar SQL

```powershell
$env:SUPABASE_ACCESS_TOKEN = (Get-Content "C:\Users\eduardo.falcao\claude\raiz_obras\.supabase_token")
Set-Location "C:\Users\eduardo.falcao\claude\raiz_obras"
& ".\supabase_cli\supabase.exe" db query --linked "SEU SQL AQUI"
# ou com arquivo:
& ".\supabase_cli\supabase.exe" db query --linked --file arquivo.sql
```

**ATENÇÃO:** Cloudflare bloqueia Python `urllib` na Supabase Management API. Usar `User-Agent: supabase-py/2.0.0` para contornar.

---

## 5. Banco de Dados (Supabase PostgreSQL)

### Tabela: `obras`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | serial PK | |
| `nome` | text | Nome da obra |
| `unidade` | text | Unidade escolar |
| `marca` | text | Marca(s), ex: "CUBO + QI" |
| `status` | text | "Em andamento", "Planejamento", "Concluído" |
| `contratado` | numeric | Valor base contratado com construtora |
| `pago` | numeric | Total pago (calculado e persistido) |
| `aportado` | numeric | Total aportado por investidores |
| `investimento_disponivel` | numeric | Teto do investimento externo |
| `teto_escola` | numeric | Limite de gastos do caixa da escola |
| `modelo_contrato` | text | "GLOBAL" ou "ADMINISTRACAO" |
| `constr` | text | Nome da construtora principal |
| `tem_construtora` | boolean | false = obra sem construtora |
| `pag` | jsonb | Array de pagamentos (ver estrutura abaixo) |
| `aportes` | jsonb | Array de aportes [{inv, v, d}] |
| `construtoras` | jsonb | Array de construtoras [{seq, nome, cnpj, contratado}] |
| `aditivos_contrato` | jsonb | Aditivos da obra [{data, motivo, valor, construtora_seq}] |
| `contratos` | jsonb | Array de contratos (ver estrutura abaixo) |
| `inv` | jsonb | Investidores [{nome}] |
| `taxa` | jsonb | Taxa de administração {total, pago} |
| `tipo` | text | "capex", "expansao", "nova" |
| `esfera` | text | Esfera da obra |

### Estrutura de um pagamento (`obras.pag[]`)
```json
{
  "ben": "Nome do fornecedor/beneficiário",
  "ref": "Referência/descrição",
  "v": 1234.56,
  "venc": "2026-01-15",
  "pagaEm": "2026-01-20",
  "st": "PAGO|PENDENTE",
  "cat": "id-categoria",
  "pagn": "Investidor/pagante",
  "escopoFin": "obra|extra",
  "nfNum": "12345",
  "nfTipo": "NF-e|NFS-e|Recibo",
  "nfDoc": {"storagePath": "pagamentos/xyz.pdf", "name": "nota.pdf"},
  "compDoc": {"storagePath": "pagamentos/comp.pdf", "name": "comprovante.pdf"},
  "ticketRaiz": "TR-001",
  "construtora_seq": 1,
  "contratoSeq": 1,
  "obs": "observações",
  "itens": [{"descricao": "...", "quantidade": 1, "unidade": "UN", "valor_unitario": 100, "valor_total": 100}],
  "emissao": "2026-01-10"
}
```

### Estrutura de um contrato (`obras.contratos[]`)
```json
{
  "seq": 1,
  "nome_contr": "Nome descritivo do contrato",
  "forn": "Empresa/Fornecedor",
  "cnpj_forn": "00.000.000/0000-00",
  "v": 500000.00,
  "escopo": "Descrição detalhada...",
  "modelo": "Preço Global|Por Administração|Hora Técnica|Fornecimento|Misto",
  "status_contr": "Ativo|Em negociação|Concluído|Suspenso|Rescindido",
  "data_assn": "2026-01-01",
  "data_inicio": "2026-01-15",
  "data_fim_prev": "2026-12-31",
  "plano_pagamento": "parcelas|medicoes|livre",
  "num_parc_contr": 12,
  "parcelas_contr": [{"n": 1, "v": 41666.67, "venc": "2026-02-01"}],
  "medicao_desc": "...",
  "medicao_freq": 30,
  "val_inv": 400000.00,
  "val_esc": 100000.00,
  "doc_path": "contratos/xyz.pdf",
  "obs": "...",
  "aditivos": [{"data": "2026-06-01", "motivo": "...", "valor": 50000}]
}
```

### Tabela: `user_profiles`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid PK | = auth.users.id |
| `email` | text | |
| `nome` | text | |
| `role` | text | "leitor" \| "doc" \| "editor" \| "admin" |
| `aprovado` | boolean | false = aguardando aprovação |
| `criado_em` | timestamptz | |

### Tabela: `unidades`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | text PK | ex: "u55" |
| `nome` | text | Nome completo da escola |
| `marca` | text | Ex: "CUBO" |
| `tipo` | text | "Em operação" |
| `cnpj` | text | |
| `endereco` | text | |

### Tabela: `capex_itens`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | serial PK | |
| `ano` | integer | |
| `fonte` | text | "UNIDADE", "MANUTENÇÃO", etc. |
| `unidade` | text | Nome da escola |
| `marca` | text | Marca da escola |
| `pedido` | text | Descrição do pedido |
| `ref` | text | Número do ticket/referência |
| `setor` | text | Setor responsável |
| `situacao` | text | "Pendente", "Em Andamento", "Resolvido", "Cancelado" |
| `orcamento` | numeric | |
| `aprovado` | boolean | |
| `realizado` | boolean | |
| `obs` | text | |

### Tabela: `investidores`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | serial PK | |
| `nome` | text | |
| `tipo` | text | |
| `contato` | text | |

### Tabela: `fornecedores`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | serial PK | |
| `nome` | text | |
| `cnpj` | text | |
| `tipo` | text | |
| `contato` | text | |

### Tabela: `docs_unidades`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | serial PK | |
| `unidade_id` | text | FK → unidades.id |
| `categoria` | text | |
| `nome` | text | |
| `path` | text | Caminho no Storage |
| `criado_em` | timestamptz | |

---

## 6. Autenticação (Supabase Auth)

### Roles
- `leitor` — somente visualizar
- `doc` — upload de documentos das escolas
- `editor` — criar/editar obras, pagamentos, contratos
- `admin` — tudo, incluindo aprovar usuários

### Fluxo de aprovação
1. Usuário cadastra → `auth.users` criado
2. Trigger `on_auth_user_created` → cria perfil em `user_profiles` com `aprovado=false`
3. Admin aprova → `aprovado=true`
4. `onLogin()` verifica `aprovado` antes de mostrar app

### Bug crítico (RESOLVIDO):
`upsert({aprovado:false})` em `onLogin` sobrescrevia perfis aprovados. Corrigido: usar `insert` apenas quando `error.code === 'PGRST116'` (perfil não existe). NUNCA usar `upsert` com `aprovado`.

### Painéis de login
- `lf-login` — formulário padrão
- `lf-cad` — cadastro de nova conta
- `lf-reset` — esqueci a senha
- `lf-newpwd` — criar nova senha (após link por email)
- `lf-pend` — aguardando aprovação do admin

### Políticas RLS (user_profiles)
- `usuario insere proprio perfil` — INSERT WHERE auth.uid() = id
- `autenticados leem perfis` — SELECT para role = 'authenticated'
- `autenticados atualizam perfis` — UPDATE para role = 'authenticated'
- Trigger `on_auth_user_created` usa `SECURITY DEFINER` (ignora RLS)

---

## 7. Storage (Supabase)

**Buckets (todos públicos — leitura sem auth, escrita requer authenticated):**
- `pagamentos` — NFs e comprovantes de pagamentos
- `documentos` — documentos das unidades escolares
- `contratos` — contratos assinados

**Políticas RLS confirmadas:**
- `auth_upload_pagamentos` — INSERT/UPDATE/DELETE authenticated
- `auth_upload_documentos` — idem
- `auth_upload_contratos` — idem

**Upload:** `uploadPagDoc()` — sanitiza nome do arquivo (remove caracteres especiais) antes de salvar.

**URLs:** `getDocUrl()` encoda cada segmento com `encodeURIComponent` para URLs com espaços/acentos.

**Viewer inline:**
- PDFs: PDF.js canvas — `pdfjsLib.getDocument({url, withCredentials:false})`
- Imagens: `<img src="url">`
- Vídeos/Áudios: elementos nativos HTML5
- Office: Google Docs Viewer
- Download: `downloadFromViewer()` → fetch → blob URL (funciona cross-origin)

**Bug crítico (RESOLVIDO):** `viewFile` prioriza `storagePath` sobre `dataUrl`. Arquivos sem `storagePath` não persistem após reload — upload DEVE ir para o Storage, nunca ficar apenas como dataUrl.

---

## 8. Edge Function: Leitura de NF

**Arquivo master local:** `edge_function_read_invoice.ts` (editar aqui)  
**Arquivo de deploy:** `supabase/functions/read-invoice/index.ts` (copiar do master antes de deploy)  
**URL em produção:** `https://hjccxfznojjosvanwztv.supabase.co/functions/v1/read-invoice`

**Modelo de IA:** Gemini 2.5 Flash (`gemini-2.5-flash`)  
**Chave:** Secret `GEMINI_API_KEY` no Supabase (ver seção 28 para detalhes)  
**Parâmetros:** `maxOutputTokens: 8192, temperature: 0`

**Como funciona:**
- Recebe `{imageBase64, mediaType}` via POST
- PDF enviado como `application/pdf` direto (sem converter para JPEG)
- Para imagens: `image/jpeg` ou `image/png`
- Retorna JSON estruturado com dados da NF
- Fallback 429 (quota): retorna `{ok:false, error:"..."}` → frontend chama `showManualEntry()`

**JSON retornado:**
```json
{
  "tipo_documento": "NF-e|NFS-e",
  "numero_nf": "12345",
  "serie": "001",
  "data_emissao": "2026-01-15",
  "chave_acesso": "44 dígitos",
  "emitente": {"razao_social": "...", "cnpj": "00.000.000/0000-00"},
  "itens": [{"descricao": "...", "quantidade": 1.0, "unidade": "UN", "valor_unitario": 100.0, "valor_total": 100.0}],
  "discriminacao": "texto para NFS-e",
  "valores": {"subtotal": 0, "desconto": 0, "frete": 0, "valor_total": 0},
  "pagamento": {"forma": "A_VISTA|PARCELADO", "num_parcelas": 1, "parcelas": []},
  "observacoes": ""
}
```

---

## 9. Navegação (Views)

Menu lateral (`#nav`) com botões data-nav:

| data-nav | Seção |
|----------|-------|
| `geral` | Visão Geral (consolidado de todas as obras) |
| `escolas` | Nossas Escolas (cadastro de unidades) |
| `investidores` | Investidores Externos |
| `capex` | Capex de Melhorias |
| `expansao` | Expansões de Unidades |
| `nova` | Novas Unidades |
| `docs` | Documentações das Unidades |
| `cobranca` | Cobrança (pagamentos em atraso globais) |
| `forn` | Fornecedores |
| `admin` | Administração (apenas role=admin) |

**Dentro de cada obra (`renderObra()`):**
- Abas: `resumo` | `pag` | `contr`
- `showTab(name)` navega entre abas
- Abas removidas mas redirecionadas: `aportes` → `resumo`, `custos` → `resumo`

---

## 10. Marcas e Brand Colors

```javascript
const BRAND_COLORS = {
  'RAIZ':            '#F88808',
  'QI':              '#480868',
  'CUBO':            '#08B8A8',
  'GLOBAL TREE':     '#88B858',
  'SARAH DAWSEY':    '#183868',
  'MATRIZ':          '#1868A8',
  'APOGEU':          '#0848B8',
  'LEONARDO DA VINCI': '#E86808',
  'SÁ PEREIRA':      '#0878C8',
  'SAP':             '#F85838',
  'AMERICANO':       '#0868B8',
  'UNIFICADO':       '#582878',
  'UNIÃO':           '#C83838',
};
```

**CSS variable:** `--brand-cur` — setada ao abrir obra. Todo `#view-obra` usa `var(--brand-cur)`.

**Arte das páginas:** `_makePageArt(colors, w, h, marcas)` — gera SVG com fitas ondulantes nas cores das marcas. Logos das marcas aparecem em posições artísticas rotacionadas no fundo.

**Arte da sidebar:** `updateSideArt(marcas)` — gradiente diagonal da cor da marca no `#side-color-layer`. Sem `borderRight` (causava gap visual).

**Banner da obra:** `updateObraBanner(o)` — gradiente nas cores das marcas + logos inline.

---

## 11. Fontes

- **Corpo/Títulos:** `"Outfit"` — `font-family:"Outfit",system-ui,sans-serif`
- **Números/Valores:** `"Space Grotesk"` — classe `.num`, `font-variant-numeric:tabular-nums`
- **Carga:** Google Fonts CDN

**CRÍTICO:** `font-family:'Space Grotesk'` (aspas simples) dentro de strings JS single-quoted = SyntaxError. Usar aspas duplas ou sem aspas: `font-family:Space Grotesk,sans-serif`.

---

## 12. CSS — Variáveis Globais

```css
:root {
  --paper: #F3EFE7;   /* fundo principal */
  --surface: #FFFFFF;
  --surface-2: #FBF9F4;
  --ink: #173C34;     /* texto principal */
  --ink-2: #0F2A24;
  --cream: #EDE7DA;
  --cream-soft: #B9C2BC;
  --accent: #F08700;  /* laranja Raiz */
  --accent-d: #D07000;
  --muted: #6E685B;
  --soft: #8C8576;
  --line: #E5DFD2;
  --line-2: #D8D1C0;
  --ok: #2F6E4F;      --ok-bg: #E6F0E9;
  --warn: #B7791A;    --warn-bg: #F6ECD7;
  --danger: #B23A2E;  --danger-bg: #F6E2DE;
  --info: #27607E;    --info-bg: #E2EDF2;
  --r: 10px;          --r-lg: 16px;
}
```

---

## 13. Layout

- `.app { display:flex; width:100% }` — NÃO usar `100vw` (causa overflow de 17px com scrollbar Windows)
- `.side { width:250px; position:sticky; top:0; height:100vh }` — sidebar fixa
- `.main { flex:1; overflow-y:auto; overflow-y:overlay; height:100vh }` — área principal com scrollbar flutuante
- `.wrap { padding:0 24px 80px }` — sem padding-top (phead já tem padding-top:22px)
- `.phead { padding-top:22px }` — respiro no cabeçalho de cada view
- `scrollbar-gutter:stable` REMOVIDO — usava espaço mesmo sem scrollbar

---

## 14. Variável Global `db`

```javascript
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

- **NUNCA** redeclarar `const db = ...` dentro de funções. Usar nomes alternativos: `dbBtn`, `dbEl`, etc.
- É o único cliente Supabase do sistema.

---

## 15. Funções Críticas (verificadas pelo pre_deploy_check.py)

| Função | Descrição |
|--------|-----------|
| `onLogin()` | Chamada pelo Supabase auth state change |
| `doLogin()` | Executada ao clicar "Entrar" |
| `renderGeral()` | Renderiza visão geral |
| `loadFromDB()` | Carrega todas as obras do banco |
| `openObra(id)` | Abre uma obra pelo ID |
| `renderObra()` | Renderiza a obra atual (cur) |
| `renderDashboard()` | Renderiza pane-resumo |

**ATENÇÃO:** Qualquer SyntaxError no JS torna `doLogin()` inoperante. Sintoma: tela de login aparece visualmente mas o botão não faz nada. Primeiro diagnóstico: verificar duplicatas `const`/`let` em `renderObra`.

---

## 16. Categorias de Gastos (CATS)

```javascript
const CATS = [
  {id:'serv', nome:'Serviços'},
  {id:'mat', nome:'Materiais'},
  {id:'proj', nome:'Projetos'},
  {id:'taxa', nome:'Taxas e cartório'},
  {id:'outros', nome:'Outros'},
  // + subcategorias automáticas via classifyPagamento()
];
```

**classifyPagamento(p):** detecta automaticamente categoria com base em `p.ben`, `p.ref`, `p.itens[]`.

---

## 17. Inteligência de Materiais (MATERIAL_ALIASES)

18 categorias com centenas de aliases:
- `concreto`, `aco`, `alvenaria`, `ceramica`, `pintura`, `madeira`
- `cobertura`, `hidraulica`, `eletrica`, `esquadria`, `impermeab`
- `vidro`, `louca`, `isolamento`, `serralheria`, `forro`, `argamassa_ac`

**SERVICE_TIPOS:** 13 tipos (inspeção, limpeza, vigilância, topografia, comissionamento, financeiro/cartório, etc.)

---

## 18. Helpers Financeiros

```javascript
const aditivosTotal = o => (o.aditivos_contrato||[]).reduce((a,d)=>a+(d.valor||0),0);
const contratadoTotal = o => o.contratado + aditivosTotal(o);
const saldoContr = o => contratadoTotal(o) - (o.pago + pagoExtra(o));
const saldoInv = o => o.investimento_disponivel > 0
  ? o.investimento_disponivel - (o.pago||0)
  : (o.aportado||0) - (o.pago||0);
const pagoExtra = o => (o.pag||[])
  .filter(p => p.st==='PAGO' && p.escopoFin==='extra')
  .reduce((a,p) => a+p.v, 0);
const execObra = o => contratadoTotal(o)
  ? Math.min(Math.round((o.pago+pagoExtra(o))/contratadoTotal(o)*100),100) : 0;
```

---

## 19. Escopo Financeiro dos Pagamentos

- `escopoFin: 'obra'` — pago com investimento externo, debita saldo do investimento
- `escopoFin: 'extra'` — pago pela escola (caixa próprio), não debita investimento
- `null/undefined` = 'obra' (default)

**pane-pag tem 2 níveis:**
1. Nível 1: dois cards clicáveis — "Dentro da Obra" e "Fora da Obra"
2. Nível 2: lista expandível com filtros

---

## 20. Persistência (persist)

```javascript
async function persist(obraId) {
  const obra = obras.find(o => o.id === obraId);
  const {error} = await db.from('obras').update({
    pag: obra.pag, aportes: obra.aportes, pago: obra.pago,
    aportado: obra.aportado, contratado: obra.contratado,
    construtoras: obra.construtoras, contratos: obra.contratos,
    aditivos_contrato: obra.aditivos_contrato, ...
  }).eq('id', obraId);
  if(error) { toast('Erro ao salvar: ' + error.message); return; }
}
```

**REGRA:** Nunca fire-and-forget em operações críticas. Sempre `await` e verificar `error`.

---

## 21. 24 Regras de Patch (anti-bugs reais)

### R1 — Fechar objetos JS corretamente
Ao substituir `.map(c=>({...}))`, OLD e NEW strings DEVEM terminar com `}))`.

### R2 — Aspas simples em strings JS
`font-family:'Space Grotesk'` dentro de string single-quoted quebra JS. Usar: `font-family:"Space Grotesk",sans-serif` ou sem aspas.

### R3 — Integrity check em scripts de patch
```python
critical = ['onLogin', 'renderGeral', 'async function persist(', 'function renderObra', 'loadFromDB']
if not all(fn in content for fn in critical): raise Exception("INTEGRITY FAIL")
```

### R4 — Python Windows converte LF→CRLF
`open(..., 'w')` em modo texto escreve CRLF. Arquivo cresce ~7-10KB. Normal, não afeta JS.

### R5 — `db` é variável global
Nunca declarar `const db = ...` dentro de funções.

### R6 — Nunca usar offsets fixos para navegar HTML
`content[:idx-4]` pode cortar no meio de uma tag. Usar `content.rfind('<div', 0, idx)`.

### R7 — Verificar colunas antes de usar
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='tabela' AND column_name='coluna';
```

### R8 — Operações críticas nunca fire-and-forget
```javascript
const {error} = await db.from('tabela').insert(dados);
if(error) { toast('Erro: ' + error.message); return; }
```

### R9 — delete+insert em lote é perigoso
Para dados críticos: INSERT/UPDATE/DELETE direto por ID, nunca reconstruir array inteiro.

### R10 — Race condition em async + arrays
Snapshot do objeto antes do await. Após await, verificar se array não mudou antes de usar resultado.

### R11 — Nunca redeclarar const/let em renderObra
`renderObra` já declara `const _invStats`. Usar nomes distintos (`_invStatsKpi`). Usar `var` para variáveis de cards em renderObra como prevenção.

### R12 — Template literals 3+ níveis quebram parser
Usar string concatenation com `+` para partes variáveis dentro de funções grandes com muitos template literals.

### R13 — Commit messages sem caracteres especiais
GitHub API retorna 400 para JSON com Unicode especial no commit message. Usar só ASCII.

### R14 — Redeclaração const/let = login quebrado
```python
dups = {k:v for k,v in Counter(top_decls).items() if v>1}
# Qualquer dup = SyntaxError = login inoperante
```

### R15 — Login quebrado: verificar duplicatas primeiro
Sintoma: tela aparece, botão "Entrar" não faz nada = JS falhou silenciosamente.

### R16 — Aspas simples de fontes = SyntaxError
Grep por `font-family:'[A-Z]` em contexto JS deve retornar 0.

### R17 — omSyncConstrutoras() antes de re-renderizar
`omAddConstrutora()` e `omRemoveConstrutora()` DEVEM chamar `omSyncConstrutoras()` primeiro. `omRenderConstrutoras()` recria HTML do zero — sem sync, valores digitados somem.

### R18 — escHtml() definida antes de omRenderConstrutoras()
`omRenderConstrutoras()` usa `escHtml()`. Função está na linha imediatamente acima.

### R19 — font-family com aspas em style="" HTML
`style="font-family:"Space Grotesk""` fecha o atributo prematuramente. Usar sem aspas: `font-family:Space Grotesk,sans-serif`.

### R20 — Fonte monospace é Space Grotesk (não DM Mono)
Trocada em 2026-06-02. Check de aspas simples é para Space Grotesk.

### R21 — CSS orphans quebram TODO o CSS seguinte
Fragmentos `to{...}}` fora de `@keyframes` e seletores `,}` param o parser CSS. Tela some completamente. O `pre_deploy_check.py` detecta automaticamente.

### R22 — upsert sobrescreve dados críticos
`db.from('user_profiles').upsert({aprovado:false})` faz UPDATE quando id existe → usuários aprovados perdem acesso. **Usar `insert`. Verificar erro PGRST116 antes de criar perfil.**

### R23 — width:100vw = overflow com scrollbar
Em Windows, `100vw` inclui scrollbar (~17px). Usa `width:100%` no `.app`.

### R24 — scrollbar-gutter:stable reserva espaço fixo
Sempre reserva ~17px mesmo sem scrollbar. Usar `overflow-y:overlay` (flutuante) ou remover.

---

## 22. Pre-Deploy Check

**Arquivo:** `pre_deploy_check.py`  
**Executar SEMPRE antes de qualquer deploy.**

Verifica automaticamente:
1. Backticks balanceados (template literals)
2. `font-family:'...'` em strings JS single-quoted
3. `const`/`let` duplicados no escopo top-level de `renderObra`
4. Referências a panes removidos (`pane-aportes`, `pane-custos`)
5. Panes críticos existem no HTML (`pane-resumo`, `pane-pag`, `pane-contr`)
6. CSS orphans — `to{}` fora de `@keyframes`, vírgulas soltas antes de `}`
7. Funções críticas presentes: `onLogin`, `doLogin`, `renderGeral`, `loadFromDB`, `openObra`, `renderObra`, `renderDashboard`
8. `showTab()` chamado para abas que existem no HTML

---

## 23. Escolas do Grupo Raiz (48 unidades)

Cadastradas em `unidades` via `nossas_escolas_A.sql`. IDs u50–u97:

**RAIZ:** Sede, Sul  
**LEONARDO DA VINCI:** Alfa, Beta, Gama  
**CUBO:** Botafogo, Barra Golf, Marapendi, Botafogo Lucena, Botafogo Assunção  
**QI:** Freguesia, Metropolitano, Rio 2, Recreio, Tijuca, Valqueire, Botafogo  
**MATRIZ:** Bangu, Campo Grande, Caxias, Madureira, Nova Iguaçu, Retiro, Rocha Miranda, São João de Meriti, Tijuca, Taquara, Expansão Bangu  
**APOGEU:** Zona Norte, Cidade Alta, Ferreira Guimarães, Santo Antônio 1, Santo Antônio 2  
**AMERICANO:** Cabral, Ramiro  
**UNIFICADO:** Zona Sul  
**SÁ PEREIRA:** Capistrano, Matriz  
**SAP:** Barrinha  
**SARAH DAWSEY:** Tijuca, Juiz de Fora  
**GLOBAL TREE:** Botafogo, Barra Golf, Marapendi, Península, Rio 2  
**INTEGRA:** Escola Integra  
**UNIÃO:** Colégio União  

---

## 24. Dashboard da Obra (`renderDashboard`)

Seções do `pane-resumo`:
1. **Cards consolidados (KPIs)** — Contrato, Investimento Externo, Caixa da Escola
2. **Top Fornecedores** — ranking dos 5 maiores por valor pago (barra proporcional)
3. **Insights de tempo** — ritmo mensal, projeção de duração do investimento, mês de maior gasto
4. **Alertas contextuais** — atraso, estouro de contrato, investimento crítico
5. **Execução dos Contratos** — progresso individual
6. **Próximos vencimentos** — 30 dias + atrasos (até 8 itens)
7. **Evolução mensal** — gráfico de barras SVG
8. **Distribuição por categoria** — barras de progresso
9. **Últimas movimentações** — 6 pagamentos mais recentes
10. **Investidores e Aportes** — histórico completo de depósitos

---

## 25. Convenções de Código

- Variável global `obras` = array de todas as obras carregadas
- Variável global `cur` = obra atualmente aberta
- `g(id)` = `document.getElementById(id)` (helper)
- `fmt(v)` = formata número como BRL (R$ 1.234,56)
- `parseCurrency(s)` = inverso do fmt
- `fmtD(iso)` = formata data ISO como DD/MM/AAAA
- `toast(msg)` = exibe notificação temporária
- `askConfirm(msg, callback)` = modal de confirmação antes de excluir
- `HOJE` = `new Date()` calculado na inicialização

---

## 26. Fluxo de Importação de NF (openImport)

1. Usuário abre overlay de lançamento de pagamento
2. Clica "Ler NF com IA"
3. Seleciona arquivo (PDF/imagem)
4. `uploadToEdgeFunction()` → envia para Edge Function `/read-invoice`
5. Edge Function → Gemini 2.5 Flash → retorna JSON estruturado
6. Frontend preenche campos automaticamente
7. Se quota 429 → `showManualEntry()` → campos ficam editáveis manualmente
8. Usuário confirma e salva

**CRÍTICO:** `openImport()` deve limpar todos os campos ao abrir entre notas diferentes.

---

## 27. Pendências Abertas (2026-06-08)

1. **MN DEVEZA (id=5310):** Pagamento pendente de leitura de NF por quota Gemini. Rodar `batch_read_nfs.py` quando quota resetar.
2. **Verificar qualidade de leitura:** confirmar se Edge Function v18 (Gemini 2.5 Flash) lê bem os itens de material.
3. **Verificar openImport():** confirmar se está limpando campos corretamente entre notas.

---

## 28. Informações de Segurança

**NÃO commitar em repositório público:**
- `.github_token`
- `.supabase_token`
- Qualquer valor de API key direto no código (usar Supabase Secrets)

**Secrets necessários para o sistema funcionar:**

| Secret | Onde fica | Como obter/rotacionar |
|--------|-----------|----------------------|
| `GEMINI_API_KEY` | Supabase → Edge Functions → Secrets | https://aistudio.google.com → API Keys |
| `SUPABASE_ACCESS_TOKEN` | Arquivo local `.supabase_token` | https://supabase.com/dashboard/account/tokens |
| GitHub PAT | Arquivo local `.github_token` | https://github.com/settings/tokens (escopo: repo) |

**Recuperar a `GEMINI_API_KEY` atual:**
1. Acessar https://supabase.com/dashboard/project/hjccxfznojjosvanwztv/functions
2. Clicar em "read-invoice" → "Secrets"
3. Se não aparecer o valor (Supabase oculta secrets existentes), gerar nova em aistudio.google.com e atualizar

**Localização dos arquivos de token locais (Windows do Eduardo):**
- `C:\Users\eduardo.falcao\claude\raiz_obras\.github_token`
- `C:\Users\eduardo.falcao\claude\raiz_obras\.supabase_token`

---

## 29. Como Trabalhar com Este Projeto

### Para fazer uma mudança no frontend:
1. Editar `raiz_index.html`
2. Rodar `python pre_deploy_check.py`
3. Se aprovado: copiar para `index.html`
4. Publicar via script Python (seção 4.1)
5. Aguardar Vercel auto-deploy (~30s)

### Para fazer uma mudança no banco:
1. Preparar SQL
2. Executar via supabase CLI (seção 4.3)
3. Verificar resultado

### Para atualizar a Edge Function:
1. Editar `edge_function_read_invoice.ts`
2. Publicar via PowerShell (seção 4.2)

### Para debug de JS quebrado:
1. Abrir console do browser em https://raiz-obras.vercel.app
2. Ver erro exato
3. Se "doLogin não funciona": rodar pre_deploy_check.py → provavelmente duplicata const/let

---

---

## 30. Checklist de Retomada (para qualquer AI assistant)

Ao abrir este projeto pela primeira vez:

1. **Ler este arquivo inteiro** antes de tocar em qualquer código
2. Clonar ou baixar `index.html` do repositório — é o arquivo de trabalho
3. Conferir seção 21 (24 Regras de Patch) — são os erros mais caros
4. Antes de qualquer deploy: rodar `scripts/pre_deploy_check.py`
5. Deploy = copiar para `index.html` + publicar via GitHub API (seção 4.1)
6. **Nunca** usar `git push` diretamente — sempre via GitHub API com token
7. Tokens estão em arquivos locais no Windows do Eduardo (seção 3), nunca no repo

---

*Última atualização: 2026-06-08*
