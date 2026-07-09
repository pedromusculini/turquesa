# Infraestrutura — Turquesa Agenda e MedSupAPP

Dois deploys independentes a partir do mesmo template de código. O isolamento entre produtos é **por projeto de infraestrutura**, não por coluna `product_id` em todas as tabelas de tenant.

**Última revisão:** 2026-07-09 · **Versionado no Git** (`docs/` no repositório; `docs/local/` só na máquina).

## Resumo

| Camada | Turquesa Agenda | MedSupAPP |
|--------|-----------------|-----------|
| **Produção** | https://www.turquesaagenda.com.br | https://www.medsupapp.com.br |
| **GitHub** | `pedromusculini/turquesa` | `pedromusculini/medsupapp` |
| **Vercel** | Projeto **`turquesa`** | Projeto **`medsupapp`** |
| **Supabase** | Projeto **próprio** (ref: `xzujpefaifxrxyjmkrhw`) | Projeto **próprio** (ref: `xbhqxhcryvumrzjiuswx`) |
| **Google OAuth** | Client **próprio** | Client **próprio** |
| **Asaas** | Conta / webhook **próprios** (ou mesma conta CNPJ — URLs de webhook distintas) | Conta / webhook **próprios** |
| **Resend (conta)** | `marrissamartins@gmail.com` | `pedromusculini@gmail.com` |
| **Resend (From)** | `naoresponda@turquesaagenda.com.br` | `naoresponda@medsupapp.com.br` |
| **`INTERNAL_PRODUCT_ID`** | `turquesa-agenda` | `medsupapp` |

**Regra:** nunca copiar `NEXT_PUBLIC_SUPABASE_*`, `AUTH_SECRET`, `GOOGLE_*`, `RESEND_API_KEY` nem `ASAAS_*` de um produto para o outro. Cada `.env.local` deve apontar para **um** Supabase — confira o ref na URL (`https://<ref>.supabase.co`). Ver [CLONAR_PRODUTO_SAAS.md](./docs/CLONAR_PRODUTO_SAAS.md).

### Resend — contas separadas (jul/2026)

Plano free Resend = **1 domínio por conta**. MedSup e Turquesa **não** compartilham conta.

| | MedSupAPP | Turquesa Agenda |
|---|-----------|-----------------|
| Conta Resend | `pedromusculini@gmail.com` | `marrissamartins@gmail.com` |
| Domínio verificado | `medsupapp.com.br` | `turquesaagenda.com.br` |
| Setup | `docs/RESEND_MEDSUP_SETUP.md` (repo MedSup) | [docs/RESEND_TURQUESA_SETUP.md](./docs/RESEND_TURQUESA_SETUP.md) |

## Painel admin interno

| | Turquesa Agenda | MedSupAPP |
|---|-----------------|-----------|
| **URL canônica** | `/painel-turque-agenda` | `/naomexaaquiseucorno` |
| **API canônica** | `/api/painel-turque-agenda/*` | `/api/naomexaaquiseucorno/*` |
| **Pastas no código** | `app/naomexaaquiseucorno/` (rewrite no `next.config.ts`) | `app/naomexaaquiseucorno/` |
| **`ADMIN_EMAILS` vazio** | Fallback `pedromusculini@gmail.com` | Ninguém é admin (404) |
| **Extras** | API `/pricing` (plano `ilimitado`) | `/planos` admin, API `plans`, `reset-prontuario` |

Middleware protege URL canônica **e** paths físicos legados (`/naomexaaquiseucorno`, `/api/naomexaaquiseucorno`).

Detalhes operacionais: [docs/INTERNAL_OPS.md](./docs/INTERNAL_OPS.md).

## Verificação de e-mail (OTP)

| | Turquesa Agenda | MedSupAPP |
|---|-----------------|-----------|
| **Tabela** | `verification_codes` (Supabase **deste** projeto) | Idem, banco **dele** |
| **TTL** | 5 minutos | 15 minutos |
| **Remetente** | `Turquesa Agenda <naoresponda@turquesaagenda.com.br>` | `MedSupAPP <naoresponda@medsupapp.com.br>` |

Códigos OTP de um produto **não** validam no outro (bancos separados).

## O que `product_id` filtra

| Tabela | Filtro |
|--------|--------|
| `internal_audit_log` | Sim |
| `subscription_billing_config` | Sim |
| `internal_tenant_notes` | Grava; leitura não filtra |
| Tenants (`google_account_access`, etc.) | Não — isolamento = Supabase separado |

## Cobrança e `/renovar`

Trial 30 dias; bloqueio pós-trial; página `/renovar` para pagar sem acessar o app.

| | Turquesa Agenda | MedSupAPP |
|---|-----------------|-----------|
| **Planos** | Único `ilimitado` — R$ 79,90/mês | `medico-pix`, `clinica-3`, `clinica-ilimitada` |
| **Usuário bloqueado** | Redirect → `/renovar` | Redirect → `/renovar` |

Ver [docs/ASAAS_BILLING.md](./docs/ASAAS_BILLING.md).

## Checklist de validação (pós-clone)

1. `NEXT_PUBLIC_SUPABASE_URL` **diferente** entre os dois `.env.local` / Vercel.
2. OTP enviado do domínio correto (From no cabeçalho do e-mail).
3. Admin: login allowlist → painel; outro e-mail → 404.
4. `internal_audit_log.product_id` = `turquesa-agenda` ou `medsupapp` conforme o deploy.
5. Webhook Asaas aponta para o domínio **do mesmo** produto.

## Documentação relacionada

- [docs/INTERNAL_OPS.md](./docs/INTERNAL_OPS.md) — painel Turquesa
- [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md) — variáveis
- [docs/SECURITY.md](./docs/SECURITY.md) — Git, secrets, checklist
- Espelho MedSup: `docs/INFRAESTRUTURA_DUPLO_SAAS.md` no repositório MedSupAPP
