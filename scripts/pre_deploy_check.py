"""
PRE-DEPLOY CHECK — executar antes de qualquer deploy
Verifica problemas críticos que já quebraram o sistema
"""
import re, sys, collections
sys.stdout.reconfigure(encoding='utf-8')

with open('C:/Users/eduardo.falcao/claude/raiz_obras/raiz_index.html','r',encoding='utf-8') as f:
    content=f.read()

scripts=re.findall(r'<script[^>]*>(.*?)</script>',content,re.DOTALL)
js=scripts[3]
errors=[]; warnings=[]

# 1. Backticks balanceados (detecta template literal não fechado)
bt=js.count('`')
if bt%2!=0: errors.append(f'BACKTICK IMPAR: {bt} — template literal não fechado!')

# 2. font-family com aspas simples em STRINGS JS (não template literals)
# Padrão perigoso: 'something font-family:'Font Name' something'
# Distinguir de template literals (que são seguros)
lines_js=js.split('\n')
for ln,line in enumerate(lines_js,1):
    stripped=line.strip()
    if stripped.startswith('//') or '`' in line: continue
    # String concatenation com font-family e aspas simples dentro
    if "font-family:'" in line:
        # Verificar se está dentro de concatenação com '+' (problemático)
        before=line[:line.find("font-family:'")]
        if "'+'" in before or before.count("'")==before.rfind("'")//1:
            errors.append(f'L{ln}: font-family com aspas simples em string JS: {line[:80]}')

# 3. Const/let duplicados em renderObra — APENAS no escopo top-level (2 espaços)
idx_ro=js.find('function renderObra('); idx_roe=js.find('\nfunction ',idx_ro+20)
ro=js[idx_ro:idx_roe]
# Só pegar declarações com exatamente 2 espaços de indentação (top-level da função)
top_decls=re.findall(r'^  (?:const|let)\s+(\w+)',ro,re.MULTILINE)
dups={k:v for k,v in collections.Counter(top_decls).items() if v>1}
if dups: errors.append(f'CONST/LET DUPLICADOS (escopo top renderObra): {list(dups.keys())}')

# 4. getElementById de elementos CRÍTICOS que podem não existir
# Só verificar panes e elementos que NÃO são criados dinamicamente
critical_panes=['pane-resumo','pane-pag','pane-contr']
removed_panes=['pane-aportes','pane-custos']

# Verificar panes removidos ainda referenciados com .innerHTML
for pid in removed_panes:
    if f'getElementById("{pid}").innerHTML' in js or f"getElementById('{pid}').innerHTML" in js:
        errors.append(f'getElementById("{pid}").innerHTML — PANE REMOVIDO DO HTML ainda referenciado!')

# Verificar panes críticos que DEVEM existir
html_ids=set(re.findall(r'id=["\']([^"\']+)["\']',content))
for pid in critical_panes:
    if pid not in html_ids:
        errors.append(f'"{pid}" não existe no HTML mas é critical!')

# 4b. CSS orphans — blocos to{}/from{} fora de @keyframes
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

# 5. Funções críticas presentes
for fn in ['onLogin','doLogin','renderGeral','loadFromDB','openObra','renderObra','renderDashboard']:
    if fn not in js:
        errors.append(f'FUNÇÃO CRÍTICA AUSENTE: {fn}')

# 6. showTab para abas que realmente não existem (ignorar 'aportes'/'custos' que redirecionam)
tabs_html=set(re.findall(r'data-tab=["\']([^"\']+)["\']',content))
redirect_ok={'aportes','custos'}  # essas foram redirecionadas para 'resumo'
tabs_in_code=set(re.findall(r"showTab\(['\"]([^'\"]+)['\"]\)",js))
for t in tabs_in_code-redirect_ok:
    if t not in tabs_html:
        errors.append(f'showTab("{t}") — aba não existe no HTML (não é um redirect)!')

# RESULTADO
print('='*60)
print('PRE-DEPLOY CHECK')
print('='*60)
if errors:
    print(f'\n❌ {len(errors)} ERRO(S):')
    for e in errors: print(f'   • {e}')
    print('\nNÃO FAZER DEPLOY até corrigir!')
else:
    print('\n✅ APROVADO — pode fazer deploy')
if warnings:
    print(f'\n⚠ {len(warnings)} aviso(s) menores')
print(f'\nBacsticks: {bt} ({bt//2} pares) | JS: {len(lines_js)} linhas')
print('='*60)
sys.exit(1 if errors else 0)
