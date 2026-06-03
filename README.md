# MedSupAPP

SaaS para médicos e clínicas: agenda, agendamento público, financeiro, formulários, Google Calendar/Drive e lembretes WhatsApp (wa.me).

**Produção:** https://www.medsupapp.com.br

## Stack

Next.js 16 · React 19 · TypeScript · Auth.js (Google) · Supabase · Vercel

## Rodar localmente

```bash
npm install
cp .env.example .env.local
# Preencha .env.local (Google OAuth, Supabase, Resend, etc.)
npm run dev
```

Build de produção (igual à Vercel):

```bash
npm run build
npm start
```

## Variáveis principais (`.env.local`)

| Variável | Uso |
|----------|-----|
| `AUTH_SECRET` | Sessão NextAuth |
| `AUTH_URL` | URL do app (ex. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Login e APIs Google |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Banco |
| `RESEND_API_KEY` | Código de verificação por e-mail |
| `ADMIN_EMAILS` | Allowlist do painel `/naomexaaquiseucorno` (opcional; sem link no app) |

Schemas SQL, deploy e documentação operacional ficam **apenas na máquina local** (pastas ignoradas pelo Git).

## Rotas principais

| Path | Descrição |
|------|-----------|
| `/login` | Entrada com Google |
| `/auth/verificar-email` | Confirmação de e-mail |
| `/onboarding` | Cadastro inicial |
| `/dashboard` | Início |
| `/agenda` | Agenda |
| `/clientes` | Pacientes |
| `/financeiro` | Financeiro |
| `/agendar/[slug]` | Agendamento público |
| `/f/[token]` | Formulário público |

## Segurança

Não commitar `.env.local`, chaves de serviço ou tokens. Páginas legais: `/privacidade`, `/termos`.
