# Infraestrutura — Turquesa Agenda e MedSupAPP

Dois deploys independentes a partir do mesmo template de código. O isolamento entre produtos é **por projeto de infraestrutura**, não por coluna `product_id` em todas as tabelas de tenant.

**Última revisão:** 2026-06-23 · **Versionado no Git** (`docs/` no repositório; `docs/local/` só na máquina).

## Resumo

| Camada | Turquesa Agenda | MedSupAPP |
|--------|-----------------|-----------|
| **Produção** | https://www.turquesaagenda.com.br | https://www.medsupapp.com.br |
| **Vercel** | Projeto `turquesa-agenda` | Projeto `medsupapp` |
| **Supabase** | Projeto **próprio** (ref: `xzujpefaifxrxyjmkrhw`) | Projeto **próprio** |
| **Google OAuth** | Client **próprio** | Client **próprio** |
| **Asaas** | Conta Asaas (pode ser **a mesma** do MedSup — mesmo CNPJ); webhook URL **própria** | Idem — `npm run asaas:sync-from-medsup` |
| **Resend** | `naoresponda@turquesaagenda.com.br` | `naoresponda@medsupapp.com.br` |
| **`INTERNAL_PRODUCT_ID`** | `turquesa-agenda` | `medsupapp` |

**Regra:** nunca copiar secrets do MedSup para o Turquesa **exceto Asaas** quando for a mesma conta/CNPJ (API key + token webhook compartilhados; URLs de webhook diferentes). Playbook: `docs/CLONAR_PRODUTO_SAAS.md`.

## Painel admin interno

| | Turquesa Agenda | MedSupAPP |
|---|-----------------|-----------|
| **URL canônica** | `/painel-turque-agenda` | `/naomexaaquiseucorno` |
| **API canônica** | `/api/painel-turque-agenda/*` | `/api/naomexaaquiseucorno/*` |
| **Pastas no código** | `app/naomexaaquiseucorno/` (rewrite no `next.config.ts`) | `app/naomexaaquiseucorno/` |
| **`ADMIN_EMAILS` vazio** | Fallback `pedromusculini@gmail.com` | Ninguém é admin (404) |
| **Extras** | API `/pricing` (plano `ilimitado`) | `/planos` admin, API `plans`, `reset-prontuario` |

Middleware protege URL canônica **e** paths físicos legados (`/naomexaaquiseucorno`, `/api/naomexaaquiseucorno`).

Detalhes operacionais: `docs/INTERNAL_OPS.md` (local).

## Verificação de e-mail (OTP)

| | Turquesa Agenda | MedSupAPP |
|---|-----------------|-----------|
| **Tabela** | `verification_codes` (Supabase **deste** projeto) | Idem, banco **dele** |
| **TTL** | 5 minutos | 15 minutos |
| **Remetente** | `Turquesa Agenda <naoresponda@turquesaagenda.com.br>` | `MedSupAPP <naoresponda@medsupapp.com.br>` |

## O que `product_id` filtra

| Tabela | Filtro |
|--------|--------|
| `internal_audit_log` | Sim |
| `subscription_billing_config` | Sim |
| `internal_tenant_notes` | Grava; leitura não filtra |
| Tenants (`google_account_access`, etc.) | Não — isolamento = Supabase separado |

## Cobrança e `/renovar`

Trial 30 dias; bloqueio pós-trial; página `/renovar` para pagar sem acessar o app. Plano único **R$ 79,90/mês**. Ver `docs/ASAAS_BILLING.md`.

## Espelho no MedSupAPP

Versão versionada em `docs/INFRAESTRUTURA_DUPLO_SAAS.md` no repositório MedSupAPP.
