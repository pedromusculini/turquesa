# Turquesa Agenda

SaaS para **salões e estúdios de beleza** (solo ou equipe): agenda, clientes, catálogo de serviços/produtos, financeiro com repasse, agendamento público, Google Calendar/Drive e lembretes WhatsApp (wa.me).

**Produção:** https://www.turquesaagenda.com.br  
**Plano:** Turquesa Agenda Ilimitado — R$ 79,90/mês, trial 30 dias, até 999 profissionais.

## Stack

Next.js 16 · React 19 · TypeScript · Auth.js (Google) · Supabase · Vercel (gru1)

## Rodar localmente

```bash
npm install
cp .env.example .env.local
# Preencha .env.local (Google OAuth, Supabase, Resend, Asaas…)
npm run dev
```

Build de produção (igual à Vercel):

```bash
npm run build
npm start
```

Bypass de login só em dev: ver `docs/DEV_LOCAL.md` (pasta local, fora do Git).

## Variáveis principais (`.env.local`)

| Variável | Uso |
|----------|-----|
| `AUTH_SECRET` | Sessão NextAuth |
| `AUTH_URL` | URL do app (ex. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Login e APIs Google |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Banco |
| `RESEND_API_KEY` | Código de verificação por e-mail |
| `ADMIN_EMAILS` | Allowlist do painel interno `/naomexaaquiseucorno` |
| `ASAAS_*` | Cobrança (ver `docs/ASAAS_BILLING.md`) |

## Rotas principais

| Path | Descrição |
|------|-----------|
| `/login` | Entrada com Google |
| `/onboarding` | Cadastro inicial do salão |
| `/dashboard` | Início — Google, lembretes, agenda de hoje |
| `/agenda` | Agenda (calendário + finalização) |
| `/clientes` | Clientes (Drive) |
| `/dashboard/catalogo` | Catálogo serviços e produtos |
| `/financeiro` | Financeiro e repasse |
| `/dashboard/comunicacao` | Mensagens WhatsApp e link público |
| `/dashboard/configuracoes` | Taxas, equipe, agenda, anamnese |
| `/agendar/[slug]` | Agendamento público |
| `/f/[token]` | Formulário de cadastro do cliente |
| `/c/[token]` | Vitrine pública do catálogo |

## Terminologia (UI)

| Evitar (legado médico) | Usar |
|------------------------|------|
| Paciente | Cliente |
| Médico / CRM | Profissional |
| Consulta | Sessão / atendimento |
| Clínica | Salão / estúdio |

Nomes de tabelas SQL (`clinica_medicos`, etc.) permanecem até migração dedicada.

## Deploy

```bash
npm run build          # após mudança de código
git commit …           # quando pedir release
npm run release        # push + promote www (ver docs/COMMIT_AND_DEPLOY.md)
npm run test:e2e       # smoke touch (Playwright), opcional antes do release
```

SQL novo: `npm run db:*` conforme `package.json` — procedimento em `docs/SUPABASE_LOCAL.md`.

## Documentação

A pasta **`docs/`** fica **somente na máquina local** (`.gitignore`). Índice completo: `docs/README.md`.

| Doc local | Conteúdo |
|-----------|----------|
| `docs/FUNCIONALIDADES.md` | Módulos e comportamento do produto |
| `docs/COMMIT_AND_DEPLOY.md` | Commit, push, promote, health check |
| `docs/REGRAS_FINANCEIRO.md` | Repasse profissionais e taxas |
| `docs/SEUS_PROXIMOS_PASSOS.md` | Checklist pós-deploy |
| `docs/PENDENCIAS.md` | Backlog técnico e releases pendentes |

Referência rápida para assistentes: `AGENTS.md` e `project_summary.txt` (também locais).

## Segurança

Não commitar `.env.local`, chaves de serviço ou tokens. Páginas legais: `/privacidade`, `/termos`.
