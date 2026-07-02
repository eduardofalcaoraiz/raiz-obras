"""
PRE-DEPLOY CHECK - executar antes de qualquer deploy.
Verifica problemas criticos que ja quebraram o sistema.
"""
import os, re, sys, collections
sys.stdout.reconfigure(encoding='utf-8')

BASE='C:/Users/eduardo.falcao/claude/raiz_obras'
HTML_PATH=next((p for p in [
    f'{BASE}/raiz_index.html',
    f'{BASE}/raiz_working.html',
    f'{BASE}/index.html',
] if os.path.exists(p)), None)
if not HTML_PATH:
    raise FileNotFoundError('Nenhum HTML encontrado para validar.')

with open(HTML_PATH,'r',encoding='utf-8') as f:
    content=f.read()

scripts=re.findall(r'<script[^>]*>(.*?)</script>',content,re.DOTALL)
js=next((s for s in scripts if 'const SUPA_URL' in s and 'function renderObra' in s), scripts[-1] if scripts else '')
errors=[]; warnings=[]

# 0. Sequencias reais de mojibake. Nao procurar "Ã" isolado:
# ele e uma letra valida em palavras como ACAO/ADMINISTRACAO.
mojibake_tokens=[
    chr(0x00c3)+chr(0x00a7),
    chr(0x00c3)+chr(0x00a3),
    chr(0x00c3)+chr(0x00a1),
    chr(0x00c3)+chr(0x00a9),
    chr(0x00c3)+chr(0x00aa),
    chr(0x00c3)+chr(0x00b3),
    chr(0x00c3)+chr(0x00ba),
    chr(0x00c2)+chr(0x00b7),
    chr(0x00e2)+chr(0x20ac)+chr(0x201d),
    chr(0x00e2)+chr(0x20ac)+chr(0x201c),
    chr(0xfffd),  # replacement char
]
moji_hits=[]
for token in mojibake_tokens:
    if token in content:
        pos=content.find(token)
        line=content.count('\n',0,pos)+1
        snippet=content[max(0,pos-45):pos+85].replace('\n',' ')
        moji_hits.append(f'L{line}: token {token!r} em ...{snippet}...')
if moji_hits:
    errors.append('MOJIBAKE/ACENTUACAO QUEBRADA: '+' | '.join(moji_hits[:12]))

# 1. Backticks balanceados (detecta template literal nao fechado)
bt=js.count('`')
if bt%2!=0: errors.append(f'BACKTICK IMPAR: {bt} - template literal nao fechado!')

# 2. font-family com aspas simples em STRINGS JS (nao template literals)
# Padrao perigoso: 'something font-family:'Font Name' something'
# Distinguir de template literals (que sao seguros)
lines_js=js.split('\n')
for ln,line in enumerate(lines_js,1):
    stripped=line.strip()
    if stripped.startswith('//') or '`' in line: continue
    # String concatenation com font-family e aspas simples dentro
    if "font-family:'" in line:
        # Verificar se esta dentro de concatenacao com '+' (problematico)
        before=line[:line.find("font-family:'")]
        if "'+'" in before or before.count("'")==before.rfind("'")//1:
            errors.append(f'L{ln}: font-family com aspas simples em string JS: {line[:80]}')

# 3. Const/let duplicados em renderObra - APENAS no escopo top-level (2 espacos)
idx_ro=js.find('function renderObra('); idx_roe=js.find('\nfunction ',idx_ro+20)
ro=js[idx_ro:idx_roe]
# So pegar declaracoes com exatamente 2 espacos de indentacao (top-level da funcao)
top_decls=re.findall(r'^  (?:const|let)\s+(\w+)',ro,re.MULTILINE)
dups={k:v for k,v in collections.Counter(top_decls).items() if v>1}
if dups: errors.append(f'CONST/LET DUPLICADOS (escopo top renderObra): {list(dups.keys())}')

# 4. getElementById de elementos CRITICOS que podem nao existir
# So verificar panes e elementos que NAO sao criados dinamicamente
critical_panes=['pane-resumo','pane-pag','pane-contr']
removed_panes=['pane-aportes','pane-custos']

# Verificar panes removidos ainda referenciados com .innerHTML
for pid in removed_panes:
    if f'getElementById("{pid}").innerHTML' in js or f"getElementById('{pid}').innerHTML" in js:
        errors.append(f'getElementById("{pid}").innerHTML - PANE REMOVIDO DO HTML ainda referenciado!')

# Verificar panes críticos que DEVEM existir
html_ids=set(re.findall(r'id=["\']([^"\']+)["\']',content))
for pid in critical_panes:
    if pid not in html_ids:
        errors.append(f'"{pid}" nao existe no HTML mas e critical!')

# 4b. CSS orphans - blocos to{}/from{} fora de @keyframes
style_block=re.search(r'<style[^>]*>(.*?)</style>',content,re.DOTALL)
if style_block:
    css=style_block.group(1)
    for m in re.finditer(r'\bto\{[^}]+\}\}',css):
        before=css[max(0,m.start()-150):m.start()]
        if '@keyframes' not in before and 'from{' not in before:
            errors.append(f'CSS ORPHAN: to{{}} fora de @keyframes: {css[m.start():m.end()][:60]}')
    # Seletor malformado (vírgula antes de })
    for m in re.finditer(r',\s*\}',css):
        before=css[max(0,m.start()-100):m.start()]
        if not any(x in before for x in ['"','//']):
            errors.append(f'CSS MALFORMADO: vírgula solta antes de }}: ...{css[max(0,m.start()-30):m.end()]}')
            break

# 5. Funcoes criticas presentes
for fn in ['onLogin','doLogin','renderGeral','loadFromDB','openObra','renderObra','renderDashboard']:
    if fn not in js:
        errors.append(f'FUNCAO CRITICA AUSENTE: {fn}')

# 6. showTab para abas que realmente nao existem (ignorar 'aportes'/'custos' que redirecionam)
tabs_html=set(re.findall(r'data-tab=["\']([^"\']+)["\']',content))
redirect_ok={'aportes','custos'}  # essas foram redirecionadas para 'resumo'
tabs_in_code=set(re.findall(r"showTab\(['\"]([^'\"]+)['\"]\)",js))
for t in tabs_in_code-redirect_ok:
    if t not in tabs_html:
        errors.append(f'showTab("{t}") - aba nao existe no HTML (nao e um redirect)!')

# RESULTADO
print('='*60)
print('PRE-DEPLOY CHECK')
print('='*60)
if errors:
    print(f'\nERRO: {len(errors)} problema(s):')
    for e in errors: print(f'   - {e}')
    print('\nNAO FAZER DEPLOY ate corrigir!')
else:
    print('\nAPROVADO - pode fazer deploy')
if warnings:
    print(f'\nAVISO: {len(warnings)} aviso(s) menores')
print(f'\nBacsticks: {bt} ({bt//2} pares) | JS: {len(lines_js)} linhas')
print('='*60)
sys.exit(1 if errors else 0)
