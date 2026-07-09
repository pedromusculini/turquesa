# Repositório Git vs arquivos locais

O GitHub contém o app Next.js completo para build na Vercel e a pasta **`docs/`** (playbook operacional). Scripts de deploy/SQL e dados locais ficam fora do Git (`.gitignore`).

**Última revisão:** 2026-07-09

## Versionado (GitHub)

| Área | Conteúdo |
|------|----------|
| `app/` | Páginas e rotas API |
| `components/` | UI React |
| `lib/` | Lógica de negócio e integrações |
| `public/` | Assets estáticos |
| `e2e/` | Playwright (touch select, smoke público) |
| `docs/` | Documentação operacional — índice em `docs/README.md` |
| Raiz | `auth.ts`, `middleware.ts`, `package.json`, `README.md`, `.env.example` |
| `scripts/` (parcial) | `promote-production-domain.mjs`, `apply-sql-file.mjs`, favicon, catálogo bucket, test webhook |

## Somente local (`.gitignore`)

| Pasta/arquivo | Uso |
|---------------|-----|
| `docs/local/` | Imports CSV, notas de setup pessoal |
| `docs/portfolio-logos/` | Assets de exploração de marca |
| `scripts/` (maioria) | `deploy-production.mjs`, apply SQL, testes Asaas |
| `sql/` | Schemas Supabase |
| `project_summary.txt` | Snapshot para IA / rebrand |
| `AGENTS.md` | Regras Cursor |
| `.cursor/` | Regras do vertical |
| `.env.local`, `.env.vercel*`, secrets | Nunca commitar |

## Integridade

```bash
npm run build
npm run test:e2e    # opcional; 2 testes touch
```

Após alterações de produto: atualizar `docs/FUNCIONALIDADES.md`, `project_summary.txt` e `docs/PENDENCIAS.md` localmente.

## README público vs docs

- **`README.md` (raiz)** — vai para o Git; visão geral e links para docs locais
- **`docs/README.md`** — índice canônico da documentação operacional
