# Desenvolvimento local sem login (bypass de auth)

**Uso exclusivo:** verificar UI, identidade visual e navegação no app **sem** passar pelo fluxo Google + OTP.

**Nunca em Vercel Production.** Com `VERCEL_ENV=production`, o bypass fica desligado mesmo que `DEV_BYPASS_AUTH=true`.

## Pré-requisitos (Windows)

1. Node.js 20+ e dependências: na raiz do projeto, `npm install`.
2. Arquivo `.env.local` na raiz (nunca commitar). Copie de `.env.example` se ainda não existir.
3. **`AUTH_SECRET`** (ou `NEXTAUTH_SECRET`) definido — sem isso o cookie de sessão mock **não** é emitido e `useSession()` pode ficar vazio após refresh.
4. Opcional para dados reais no Supabase: `DEV_BYPASS_EMAIL` / `DEV_BYPASS_GOOGLE_SUB` de um usuário de teste.

## Modo 1 — `npm run dev` (recomendado)

### Passo a passo (Windows, PowerShell ou Git Bash)

1. Edite `.env.local`:

```env
DEV_BYPASS_AUTH=true
AUTH_SECRET=uma-string-longa-aleatoria-local
```

2. Pare qualquer servidor antigo (Ctrl+C no terminal).

3. Inicie o dev server:

```bash
npm run dev
```

Ou, sem editar `.env.local`, só para esta sessão:

```bash
npm run dev:bypass
```

4. Abra **http://localhost:3000/dashboard** (ou `/agenda`, `/clientes`).

5. Na primeira visita, o middleware emite o cookie `authjs.session-token`. O layout usa sessão mock; `/api/auth/session` também retorna o usuário dev após o cookie existir.

`NODE_ENV=development` — **não** precisa de `DEV_LOCAL_COMPILED` nem `ALLOW_DEV_BYPASS_COMPILED`.

## Modo 2 — build local (`next start`)

`npm start` após `npm run build` roda com `NODE_ENV=production`. O bypass exige flag explícita de compilação local:

### `.env.local`

```env
DEV_BYPASS_AUTH=true
DEV_LOCAL_COMPILED=true
AUTH_SECRET=uma-string-longa-aleatoria-local
```

(`ALLOW_DEV_BYPASS_COMPILED=true` é aceito no lugar de `DEV_LOCAL_COMPILED`.)

### Comandos

```bash
npm run build
npm run start:local
```

O script `start:local` define no processo: `DEV_BYPASS_AUTH=true`, `DEV_LOCAL_COMPILED=true` e `ALLOW_DEV_BYPASS_COMPILED=true`.

**Não use** `npm start` sozinho para testar bypass — use `start:local` ou as variáveis acima no `.env.local`.

## Identidade mock (opcional)

```env
DEV_BYPASS_EMAIL=seu@gmail.com
DEV_BYPASS_GOOGLE_SUB=1234567890
DEV_BYPASS_NAME=Seu Nome
DEV_BYPASS_USER_ID=uuid-opcional
DEV_BYPASS_PLAN=ilimitado
```

Padrão: `dev-local@turquesaagenda.local`, `dev-bypass-google-sub`, plano `ilimitado`.

## Desativar

```env
DEV_BYPASS_AUTH=false
```

Remova `DEV_LOCAL_COMPILED` / `ALLOW_DEV_BYPASS_COMPILED` ou defina `false`. Reinicie o servidor.

## Checklist antes do lançamento (produção)

| Item | Ação |
|------|------|
| Vercel Production | **Nunca** `DEV_BYPASS_AUTH=true` nem flags de compilação local |
| `.env.local` | Remover ou `DEV_BYPASS_AUTH=false` |
| Preview Vercel | Bypass **desligado** (exige `DEV_LOCAL_COMPILED` + não é `development`) |
| Código | `isDevBypassAuthActive()` retorna `false` se `VERCEL_ENV === 'production'` |

## O que funciona com bypass

- **Middleware:** login, e-mail, onboarding e assinatura ignorados; cookie Auth.js emitido em rotas do app.
- **`auth()` / JWT / session callback:** token e sessão mock quando bypass ativo.
- **`getAppSession()`** no layout raiz — sessão mock garantida no servidor.
- **APIs** com `requireOwnerEmail` / `requireVerifiedOwner` — identidade mock.
- **OTP / `/auth/verificar-email`:** ignorados — `getAccessStateForUser`, `/api/auth/google-access/status`, `send-code` e `verify-code` retornam `accessVerified: true`; `/api/onboarding/status` retorna `onboardingCompleted: true`. Não é preciso passar pelo código de 6 dígitos nem completar onboarding no Supabase.

## Limitações

- **Painel interno** (`/naomexaaquiseucorno`): exige `ADMIN_EMAILS` — bypass não concede admin.
- **Google Calendar / Drive:** OAuth real; sem tokens no bypass.
- **Supabase:** dados ligados a `DEV_BYPASS_EMAIL` / `DEV_BYPASS_GOOGLE_SUB`; e-mail mock pode retornar vazio ou FK.
- **Asaas:** em local, `ASAAS_BILLING_ENFORCED=false` (`.env.example`).

## Implementação

- `lib/devBypassAuth.ts` — flags, sessão mock, cookie, JWT (`applyDevBypassToToken`)
- `lib/devBypass.ts` — re-export
- `middleware.ts` — rotas protegidas
- `auth.ts` — callbacks JWT/session
- `lib/getAppSession.ts` — servidor
- `lib/api-auth.ts` — APIs
- `lib/googleAccountAccess.ts` — `getAccessStateForUser` (bypass)
- `lib/requireGoogleAccess.ts` — `getGoogleAccessForSession` (bypass)
- `app/api/auth/google-access/*`, `app/api/onboarding/status` — rotas que o login e `/auth/verificar-email` consultam

Ver também `docs/SUPABASE_LOCAL.md` (credenciais e `npm run db:*`), `docs/SECURITY-LGPD.md`. Guia de favicon/PWA (fora do portfólio `/paleta-cores`): `docs/ICONES_IA.md`.
