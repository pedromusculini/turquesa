# Environment variables

Copy `.env.example` to `.env.local` and fill in values. Never commit `.env.local` or production secrets.

## Core

| Variable | Purpose |
|----------|---------|
| `AUTH_URL` / `NEXTAUTH_URL` | Public app URL (OAuth redirects, links in emails/WhatsApp) |
| `NEXTAUTH_SECRET` / `AUTH_SECRET` | Session encryption (use a strong random value in production) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (Calendar + Drive no login; Contatos opcional) |

Aliases supported in code: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.

Publicar o app no Google (Testing → Production + verificação): **[GOOGLE_OAUTH_PRODUCAO.md](./GOOGLE_OAUTH_PRODUCAO.md)**.  
Redirect URIs de produção: `GET /api/health/auth-config` → campo `googleRedirectUris`.

## Supabase

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin client (**must** be the `service_role` secret; never the anon key) |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI token for `npm run db:*` scripts |

After schemas are applied, run `sql/security_hardening.sql` in the Supabase SQL Editor (see [SECURITY-LGPD.md](./SECURITY-LGPD.md)).

## Email

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM` | Sender (default: `Turquesa Agenda <naoresponda@turquesaagenda.com.br>`) |
| `RESEND_REPLY_TO` | Opcional — `Reply-To` (default: `suporte@turquesaagenda.com.br`) |

Domínio verificado + SPF/DKIM/DMARC no Cloudflare: **[EMAIL_DELIVERABILITY.md](./EMAIL_DELIVERABILITY.md)**.

Conta Resend **separada** do MedSup (plano 1 domínio): **[RESEND_TURQUESA_SETUP.md](./RESEND_TURQUESA_SETUP.md)**.

OTP: tabela `verification_codes` no **Supabase deste projeto**; TTL **5 minutos** (`lib/googleVerificationCodes.ts`). Não compartilha banco com MedSupAPP — ver [INFRAESTRUTURA_DUPLO_SAAS.md](../INFRAESTRUTURA_DUPLO_SAAS.md).

**Ref Turquesa:** `xzujpefaifxrxyjmkrhw` · **Ref MedSup:** `xbhqxhcryvumrzjiuswx`. Scripts `npm run db:*` exigem `SUPABASE_ACCESS_TOKEN` em `.env.local`.

## WhatsApp

See [WHATSAPP_BUSINESS_SETUP.md](./WHATSAPP_BUSINESS_SETUP.md).

## Internal operations (backoffice)

| Variable | Purpose |
|----------|---------|
| `ADMIN_EMAILS` | E-mails Google na allowlist do painel `/painel-turque-agenda` e `/api/painel-turque-agenda/*` (server-only). **Configure na Vercel** (Production). |
| `INTERNAL_PRODUCT_ID` | Product slug for audit logs (default: `turquesa-agenda`) |

See [INTERNAL_OPS.md](./INTERNAL_OPS.md). Do **not** commit real admin e-mail addresses to the repository.

## Asaas (cobrança — produção)

Especificação: [ASAAS_BILLING.md](./ASAAS_BILLING.md). Sandbox: [ASAAS_SANDBOX_VALIDACAO.md](./ASAAS_SANDBOX_VALIDACAO.md).

| Variable | Purpose |
|----------|---------|
| `ASAAS_API_KEY` | API key — sandbox `$aact_...` ou produção `$aact_prod_...` |
| `ASAAS_API_URL` | `https://api.asaas.com/v3` (prod) ou `https://sandbox.asaas.com/api/v3` |
| `ASAAS_WEBHOOK_TOKEN` | Token do webhook no painel Asaas (header `asaas-access-token`). **Não** é a API key |
| `ASAAS_BILLING_ENFORCED` | `true` em Production após homologar; `false` desliga bloqueio |

Supabase (uma vez):

```bash
npm run db:assinaturas
npm run db:assinaturas-policy
```

Verificação: `npm run test:webhook:prod` e `GET /api/health/auth-config`.

## Vercel

Add the same variables under **Settings → Environments → Production**, then redeploy. Cron requires `CRON_SECRET` in production.
