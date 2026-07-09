# Documentação — Turquesa Agenda

Índice da documentação **versionada no repositório** (pasta `docs/local/` e `docs/portfolio-logos/` permanecem só na máquina).

**Última revisão geral:** 2026-06-23

## Começar por aqui

| Ordem | Arquivo | Para quem |
|-------|---------|-----------|
| 1 | [SEUS_PROXIMOS_PASSOS.md](./SEUS_PROXIMOS_PASSOS.md) | Primeiro uso em produção |
| 2 | [FUNCIONALIDADES.md](./FUNCIONALIDADES.md) | Visão do produto (módulos) |
| 3 | [COMMIT_AND_DEPLOY.md](./COMMIT_AND_DEPLOY.md) | Commit, push, promote |
| 4 | [ENVIRONMENT.md](./ENVIRONMENT.md) | Variáveis Vercel / local |

## Produto e negócio

| Arquivo | Conteúdo |
|---------|----------|
| [FUNCIONALIDADES.md](./FUNCIONALIDADES.md) | Agenda, clientes, catálogo, financeiro, comunicação |
| [REGRAS_FINANCEIRO.md](./REGRAS_FINANCEIRO.md) | Repasse profissionais, taxas, comissão |
| [PALETA_CORES.md](./PALETA_CORES.md) | Marca e HEX (`lib/visual/brand.ts`) |
| [paleta-cores.html](./paleta-cores.html) | Portfólio de cores (GitHub preview) |

## Infra e deploy

| Arquivo | Conteúdo |
|---------|----------|
| [INFRAESTRUTURA_DUPLO_SAAS.md](../INFRAESTRUTURA_DUPLO_SAAS.md) | Isolamento Turquesa vs MedSup (**versionado na raiz**) |
| [COMMIT_AND_DEPLOY.md](./COMMIT_AND_DEPLOY.md) | `npm run release`, hook post-push |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Vercel, domínio, troubleshooting |
| [RESEND_TURQUESA_SETUP.md](./RESEND_TURQUESA_SETUP.md) | Conta Resend dedicada + DNS OTP |
| [EMAIL_DELIVERABILITY.md](./EMAIL_DELIVERABILITY.md) | SPF/DKIM/DMARC e spam |
| [DNS_GO_LIVE.md](./DNS_GO_LIVE.md) | DNS Cloudflare / apex |
| [GOOGLE_OAUTH_PRODUCAO.md](./GOOGLE_OAUTH_PRODUCAO.md) | OAuth produção e verificação Google |
| [SUPABASE_LOCAL.md](./SUPABASE_LOCAL.md) | SQL, `npm run db:*`, Management API |
| [REPOSITORY.md](./REPOSITORY.md) | O que está no Git vs local |

## Cobrança

| Arquivo | Conteúdo |
|---------|----------|
| [ASAAS_BILLING.md](./ASAAS_BILLING.md) | Assinatura, webhook, bloqueio |
| [ASAAS_WEBHOOK_PASSO_A_PASSO.md](./ASAAS_WEBHOOK_PASSO_A_PASSO.md) | Configurar webhook |
| [ASAAS_SANDBOX_VALIDACAO.md](./ASAAS_SANDBOX_VALIDACAO.md) | Testes sandbox |

## Clone / novo vertical

| Arquivo | Conteúdo |
|---------|----------|
| [CLONAR_PRODUTO_SAAS.md](./CLONAR_PRODUTO_SAAS.md) | Fork MedSupAPP → novo SaaS |
| [MEDSUP_REBRAND_AUDIT.md](./MEDSUP_REBRAND_AUDIT.md) | Auditoria rebrand médico → salão |

## Interno (equipe Turquesa)

| Arquivo | Conteúdo |
|---------|----------|
| [INTERNAL_OPS.md](./INTERNAL_OPS.md) | Painel `/painel-turque-agenda` |
| [SECURITY-LGPD.md](./SECURITY-LGPD.md) | LGPD, Drive, metadados Supabase |
| [SECURITY.md](./SECURITY.md) | Checklist de segurança |
| [COOKIES.md](./COOKIES.md) | Inventário de cookies e localStorage |
| [ROPA_TEMPLATE.md](./ROPA_TEMPLATE.md) | Template ROPA (preencher com jurídico) |

## Desenvolvimento

| Arquivo | Conteúdo |
|---------|----------|
| [DEV_LOCAL.md](./DEV_LOCAL.md) | Bypass auth em dev |
| [BROWSER_COMPATIBILITY.md](./BROWSER_COMPATIBILITY.md) | Mobile / touch |
| [CATALOGO_FOTOS_ARMAZENAMENTO.md](./CATALOGO_FOTOS_ARMAZENAMENTO.md) | Fotos do catálogo (Supabase Storage) |

## WhatsApp (referência)

| Arquivo | Conteúdo |
|---------|----------|
| [WHATSAPP_ROADMAP.md](./WHATSAPP_ROADMAP.md) | Roadmap (API Meta **não** ativa) |
| [WHATSAPP_BUSINESS_SETUP.md](./WHATSAPP_BUSINESS_SETUP.md) | Legado / referência |

## Backlog

| Arquivo | Conteúdo |
|---------|----------|
| [PENDENCIAS.md](./PENDENCIAS.md) | Commits pendentes, melhorias futuras |

## Arquivos na raiz do repo (Git)

- `README.md` — visão geral (público)
- `INFRAESTRUTURA_DUPLO_SAAS.md` — isolamento vs MedSupAPP
- `CLONAR_PRODUTO_SAAS.md` — atalho; editar sempre `docs/CLONAR_PRODUTO_SAAS.md`

## Arquivos locais (não versionados)

- `docs/local/` — notas pessoais, imports CSV, setup local
- `docs/portfolio-logos/` — explorações de logo (binários)
- `project_summary.txt` — snapshot para IA / rebrand
- `AGENTS.md` — regras Cursor (deploy, vertical salão)
- `.cursor/rules/vertical-salao.mdc`
