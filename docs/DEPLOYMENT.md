# Deployment

Turquesa Agenda is deployed on [Vercel](https://vercel.com) (region `sfo1`, see `vercel.json`).  
Production URL: **https://www.turquesaagenda.com.br**

## Prerequisites

- GitHub repository connected to Vercel (`pedromusculini/medsupapp`, branch **`master`**)
- Supabase schemas applied (see scripts below)
- Google OAuth: ver **[GOOGLE_OAUTH_PRODUCAO.md](./GOOGLE_OAUTH_PRODUCAO.md)** (verificação + duas redirect URIs)
  - Login: `https://www.turquesaagenda.com.br/api/auth/callback/google`
  - Drive/Calendar/Contatos: `https://www.turquesaagenda.com.br/api/auth/google-callback`
- Resend domain verified for transactional email

### Supabase (ordem sugerida)

```bash
npm run db:operacional
npm run db:google-access
npm run db:consultas-whatsapp
npm run db:agendamento
npm run db:assinaturas
npm run db:assinaturas-policy
npm run db:security
```

## Environment

Set all variables in Vercel → **Settings → Environments → Production** from [ENVIRONMENT.md](./ENVIRONMENT.md).

Required:

- `AUTH_URL` / `NEXTAUTH_URL` = `https://www.turquesaagenda.com.br`
- `AUTH_SECRET`, Google OAuth, Supabase `SUPABASE_SERVICE_ROLE_KEY`
- Asaas (produção): `ASAAS_API_KEY`, `ASAAS_API_URL`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_BILLING_ENFORCED=true` — ver [ASAAS_BILLING.md](./ASAAS_BILLING.md)

WhatsApp **Cloud API** (`WHATSAPP_*`, `CRON_SECRET`) is **optional** — o produto usa lembretes **wa.me** no Dashboard.

## Custom domain

1. Vercel → **Domains** → `www.turquesaagenda.com.br` e `turquesaagenda.com.br`
2. DNS (Cloudflare, DNS only):

   | Type | Name | Content |
   |------|------|---------|
   | CNAME | `www` | valor da Vercel |
   | A | `@` | `76.76.21.21` |

3. Apex redireciona para www via `vercel.json` e middleware.

## Padrão após cada release (obrigatório)

Ver **[COMMIT_AND_DEPLOY.md](./COMMIT_AND_DEPLOY.md)**.

Resumo:

```bash
git push origin master
# Aguarde deployment Ready
npm run deploy:promote
```

O script `deploy:promote` aponta `www`, apex e alias do projeto para o deployment Production **Ready** mais recente.

## Commit no GitHub, mas o site não atualiza

**Sintoma:** push feito, deploy **Ready**, mas o site em `www` mostra versão antiga (404 em rotas novas, UI antiga).

**Causa:** alias do domínio customizado ainda no hash antigo (`medsupapp-OUTRO...`).

### Diagnóstico

```bash
npx vercel ls medsupapp
npx vercel alias ls
```

Compare o hash da primeira linha **Ready** com o `source` de `www.turquesaagenda.com.br`.

### Correção

```bash
npm run deploy:promote
```

Ou manualmente (substitua `XXXX` pelo hash do deploy novo):

```bash
npx vercel alias set medsupapp-XXXX-pedro-henrique-musculini-s-projects.vercel.app www.turquesaagenda.com.br
npx vercel alias set medsupapp-XXXX-pedro-henrique-musculini-s-projects.vercel.app turquesaagenda.com.br
```

Painel: **Deployments** → deploy do commit → **Promote to Production**.

Teste em aba anônima ou Ctrl+Shift+R.

## Integração Git

- **Settings → Git** → repo correto, **Production Branch** = `master`
- Cada push em `master` gera deploy; **ainda assim** rode `npm run deploy:promote` se o www não atualizar

## Checklist pós-push

| Passo | Ação |
|--------|------|
| Push | `git push origin master` |
| Build | Vercel → Ready |
| Domínio | `npm run deploy:promote` |
| SQL | `npm run db:*` se houve migration nova |
| Smoke | `/dashboard`, `/dashboard/comunicacao`, `/dashboard/conta`, login Google |
| Billing | `curl .../api/health/auth-config`, `npm run test:webhook:prod` |

## Troubleshooting login

Se login falhar após troca de deploy: confira `AUTH_SECRET`, `AUTH_URL`, `NEXTAUTH_URL`, Google client, `SUPABASE_SERVICE_ROLE_KEY` em Production → **Redeploy**.
