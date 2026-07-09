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
- [ ] `GET /api/health/auth-config` em prod retorna só `{ ok }` (detalhes: admin ou `HEALTH_CONFIG_SECRET`)
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

## Git e secrets (dois produtos)

- [ ] **Nunca** commitar `.env.local`, `.env.vercel*`, `client_secret*.json`, chaves `re_*`, `service_role`, tokens Asaas/Google
- [ ] `.env.example` só com placeholders — sem e-mails reais de admin em produção
- [ ] `git ls-files` não deve listar arquivos de credencial (exceto `.env.example`)
- [ ] MedSup e Turquesa: refs distintos — Turquesa `xzujpefaifxrxyjmkrhw`, MedSup `xbhqxhcryvumrzjiuswx`
- [ ] `RESEND_API_KEY` **por conta** (MedSup `pedromusculini@gmail.com`, Turquesa `marrissamartins@gmail.com`)
- [ ] `npx vercel env pull` gera `.env.vercel.*` — manter gitignored; não compartilhar dump de env
- [ ] Se `client_secret*.json` existir no disco: confirmar `.gitignore`; rotacionar secret no Google Cloud se já vazou

Ver também [REPOSITORY.md](./REPOSITORY.md) e [INFRAESTRUTURA_DUPLO_SAAS.md](../INFRAESTRUTURA_DUPLO_SAAS.md).

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
