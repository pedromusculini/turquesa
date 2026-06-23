# Segurança

Checklist para releases e auditorias. Para review automatizado: subagent **Security Review** no Cursor.

## Autenticação e sessão

- [ ] `AUTH_SECRET` forte (32+ bytes) só na Vercel/local
- [ ] APIs privadas usam `requireVerifiedOwner` ou equivalente
- [ ] OTP rate limit: 5/15min por e-mail (`send-code`)
- [ ] Middleware bloqueia cadastro e-mail legado

## Autorização

- [ ] Financeiro: `requireClinicaTitular` / titular do salão
- [ ] Profissionais da equipe: `clinica_email` = owner da sessão
- [ ] Admin: `isInternalAdminEmail` + sem link público
- [ ] Formulário profissional: token + regras em `clienteFichaAccess`

## Dados e Supabase

- [ ] `SUPABASE_SERVICE_ROLE_KEY` nunca em client bundle
- [ ] RLS aplicado (`npm run db:security` local)
- [ ] Upload portfólio: tipo imagem, max 8MB, path por owner

## Cookies e tokens

- [ ] Google tokens: httpOnly, secure em prod, sameSite lax
- [ ] Sem tokens em `localStorage` para sessão (ver `useSession.ts`)
- [ ] `prontuario_unlock` assinado, TTL limitado

## APIs públicas

- [ ] Rate limit em agendar, formulário, portfolio public
- [ ] Agendar `identificar`: sem nome completo na resposta
- [ ] Webhook Asaas: validação `ASAAS_WEBHOOK_TOKEN`
- [ ] Sem listagem de tenants sem admin

## Headers e infra

- [ ] HTTPS only em produção
- [ ] Apex redirect 308 para www
- [ ] Secrets fora do Git (`.gitignore`)

## LGPD

- [ ] Versões legais em `lib/legal.ts` alinhadas à política publicada
- [ ] `LegalReacceptModal` ativo em `app/providers.tsx`
- [ ] Canal `privacidade@turquesaagenda.com.br` na política e em `/dashboard/conta`

## Resposta a incidentes

1. Rotacionar `AUTH_SECRET` + `AUTH_SECRET_VERSION`
2. Revogar tokens Google no painel Google Cloud
3. Reset acesso tenant: `npm run tenant:reset-access` (local)

## Ferramentas

```bash
npm run audit:email-verification   # local, script em scripts/
GET /api/health/auth-config
```
