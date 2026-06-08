# Raiz Educação — Gestão de Obras e Documentos

Plataforma interna de gestão financeira de obras (CAPEX) e documentação das unidades escolares do grupo Raiz Educação.

## 🚀 App em produção
**https://raiz-obras.vercel.app**

---

## 📖 Documentação completa do projeto

> **Se você é um AI assistant (Codex, Claude, Gemini, etc.) ou um desenvolvedor novo:**
> **Leia o arquivo [`CONTEXT.md`](./CONTEXT.md) antes de qualquer coisa.**

O `CONTEXT.md` contém:
- Arquitetura completa (stack, banco, auth, storage)
- Schema detalhado de todas as tabelas
- Fluxo de deploy automatizado
- 24 regras críticas de patch (bugs reais que já quebraram o sistema)
- Brand colors, fontes, convenções de código
- Edge Function de leitura de NF com IA
- Checklist de retomada do projeto

---

## 📁 Estrutura do repositório

```
├── index.html                         ← app completo (single-file HTML/CSS/JS)
├── CONTEXT.md                         ← documentação completa e memória do projeto
├── LOGO DA *.png                      ← logos das marcas do grupo
├── scripts/
│   ├── pre_deploy_check.py            ← verificação obrigatória antes de qualquer deploy
│   └── batch_read_nfs.py              ← leitura em lote de NFs via Gemini
├── supabase/
│   └── functions/read-invoice/
│       └── index.ts                   ← Edge Function: leitura de NF com Gemini 2.5 Flash
└── sql/
    ├── auth_setup.sql                 ← trigger + policies RLS (rodar 1x no setup)
    ├── auth_setup_patch.sql           ← correção de policies
    ├── capex_E_marca.sql              ← schema capex
    ├── nossas_escolas_A.sql           ← 48 escolas do grupo
    ├── nossas_escolas_B.sql           ← normalização de nomes
    └── update_escolas.sql             ← CNPJs e endereços
```

---

## ⚡ Deploy rápido

Edite `index.html`, rode `scripts/pre_deploy_check.py` e publique via GitHub API.  
Instruções completas em [`CONTEXT.md § 4`](./CONTEXT.md).

---

*Raiz Educação · Grupo de Educação*
