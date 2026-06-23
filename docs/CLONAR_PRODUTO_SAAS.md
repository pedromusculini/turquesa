# Clonar o MedSupAPP como casca SaaS (novo vertical)

Playbook prático para **antes do lançamento** do produto atual e para **forks** (ex.: salão de beleza, depois mercado US). Este arquivo fica em `docs/` (local, fora do GitHub público).

**Referências no repo:** `project_summary.txt`, `docs/FUNCIONALIDADES.md`, `docs/ENVIRONMENT.md`, `docs/ASAAS_BILLING.md`, `docs/GOOGLE_OAUTH_PRODUCAO.md`, `docs/INTERNAL_OPS.md`, `docs/SECURITY-LGPD.md`.

---

## 1. Checklist de integridade (pré-lançamento MedSupAPP)

Use esta lista em **staging** (Vercel Preview ou `npm run dev` + `.env.local` espelhando produção) e repita em **produção** após o primeiro deploy.

### Autenticação e acesso

| # | Teste | Como validar | Falha típica |
|---|--------|--------------|--------------|
| 1 | Google OAuth login | `/login` → conta Google → sessão em `/dashboard` | `AUTH_URL` ≠ domínio; redirect URI faltando no Google Cloud |
| 2 | Redirect apex → www | Acessar `https://turquesaagenda.com.br/...` | `middleware.ts` + `vercel.json` redirects |
| 3 | OTP pós-Google | Login → `/auth/verificar-email` → código Resend → dashboard | `RESEND_API_KEY`, `RESEND_FROM`, tabela `verification_codes` |
| 4 | E-mail não verificado bloqueia app | Antes do OTP, `/agenda` redireciona ou bloqueia | middleware `isUnverifiedPagePath` |
| 5 | Cadastro e-mail/senha desativado | `/register` não deve ser fluxo principal | rotas em `emailSignupRoutes` no middleware |

### Onboarding e plano

| # | Teste | Como validar |
|---|--------|--------------|
| 6 | Onboarding obrigatório | Conta nova → `/onboarding` até salvar perfil |
| 7 | Plano na URL/query | `?plano=medico-pix` (ou clínica) refletido no perfil/Asaas |
| 8 | Médico vs clínica | Solo: sem equipe; clínica: cadastro em `clinica_medicos` respeitando limite do plano |
| 9 | Downgrade com aviso | Troca de plano em `/dashboard/conta` mostra impacto (`subscriptionPlans.ts`) |

### Google (Drive, Calendar, Contatos)

| # | Teste | Como validar |
|---|--------|--------------|
| 10 | Card no Dashboard | Conectar / sincronizar sem erro |
| 11 | Clientes no Drive | `/clientes` lista; criar paciente grava `clientes.json` na pasta do usuário |
| 12 | Agenda + Calendar | Criar consulta; opcional sync calendário |
| 13 | OAuth incremental (Contatos) | Fluxo com state HMAC; mesma sessão Google |

### Operação diária

| # | Teste | Como validar |
|---|--------|--------------|
| 14 | Agenda | CRUD consultas, status, lembretes WhatsApp (checkbox) |
| 15 | Financeiro | Entradas/saídas (Drive ou schema local conforme deploy) |
| 16 | Comunicação | Templates com variáveis bloqueadas (`MensagemTemplateEditor`) |
| 17 | WhatsApp wa.me | Dashboard gera link wa.me (sem depender de API Meta) |
| 18 | Formulário paciente | `/f/[token]` público |
| 19 | Agendamento público | `/agendar/[slug]` + sync fila |
| 20 | Calendário paciente | `/calendario/adicionar/[token]` + `.ics` |

### Cobrança Asaas

| # | Teste | Como validar |
|---|--------|--------------|
| 21 | Health config | `GET /api/health/auth-config` → `ASAAS_*` true em prod |
| 22 | Webhook | `npm run test:webhook:prod` (ou sandbox) → 200 + linha em Supabase |
| 23 | Política de billing | `npm run test:billing` |
| 24 | Bloqueio pós-expiração | `ASAAS_BILLING_ENFORCED=true` → rotas app bloqueadas; públicas OK |
| 25 | Minha conta | Link pagamento Asaas; trial 30 dias (`asaasBillingPolicy.ts`) |

### Admin e segurança

| # | Teste | Como validar |
|---|--------|--------------|
| 26 | Painel admin | E-mail em `ADMIN_EMAILS` acessa `/naomexaaquiseucorno` |
| 27 | Não-admin | Mesma URL → **404** (não 403) |
| 28 | APIs admin | `/api/naomexaaquiseucorno/*` → 404 para não-admin |
| 29 | RLS Supabase | `sql/security_hardening.sql` aplicado no projeto |
| 30 | Build CI local | `npm run build` sem erro |

### Smoke pós-deploy (produção)

```bash
curl -sS https://www.turquesaagenda.com.br/api/health/auth-config
npm run test:webhook:prod
npm run test:billing
```

Detalhes: `docs/COMMIT_AND_DEPLOY.md`, `docs/SEUS_PROXIMOS_PASSOS.md`.

---

## 2. Inventário: o que mudar por clone (top 20 áreas)

Arquivos e pastas com **marca, limites médico/clínica, domínio ou copy PT-BR** — priorize estes no rebrand com Cursor.

| Prioridade | Arquivo / área | O que personalizar |
|------------|----------------|-------------------|
| 1 | `lib/constants.ts` | `CANONICAL_APP_HOST`, `PLANOS`, `CORES`, `LANDING_PLANOS`, labels financeiros/agenda, chaves `localStorage` (`medsupapp-*`) |
| 2 | `lib/subscriptionPlans.ts` | IDs de plano, `maxMedicosCadastrados`, `planToUserType`, textos de downgrade |
| 3 | `lib/legal.ts` + `app/privacidade/page.tsx` + `app/termos/page.tsx` | Versões legais, e-mails de contato, narrativa LGPD |
| 4 | `app/layout.tsx` | `metadata` (title/description), `lang` (`pt-BR` vs `en-US`) |
| 5 | `components/LandingPageContent.tsx` + `LandingBrandAnimation.tsx` | Hero, diferencial, planos, CTA, e-mail contato |
| 6 | `app/planos/page.tsx` | Página de preços (usa `PLANOS` / catálogo) |
| 7 | `package.json` | `"name"` do pacote npm |
| 8 | `.env.example` | Comentários, `RESEND_FROM`, `INTERNAL_PRODUCT_ID`, URLs exemplo |
| 9 | `middleware.ts` | Redirect host apex (`turquesaagenda.com.br` → www) |
| 10 | `vercel.json` | Redirect de host de produção |
| 11 | `lib/constants.ts` | `ADMIN_PANEL_PATH` / `ADMIN_API_PREFIX` (recomendado: path obscuro **único** por produto) |
| 12 | `lib/email.ts` | Assunto/HTML OTP, cores do template, nome da marca |
| 13 | `lib/asaasConta.ts` | Prefixo `MedSupAPP` em customer/charge description |
| 14 | `components/Header.tsx`, `AppFooter.tsx`, `ChromeExtensionNotice.tsx` | Logo, links, nome exibido |
| 15 | `app/onboarding/page.tsx` | Campos médico (CRM, especialidade, CNPJ clínica) — **alto impacto** no vertical salão/US |
| 16 | `app/dashboard/perfil/page.tsx` + APIs `clinica_medicos` | Equipe / profissionais; renomear conceito “médico” |
| 17 | `components/MensagemTemplateEditor.tsx` + `lib/mensagemTemplate.ts` | Variáveis (“paciente”, “médico”, “consulta”) |
| 18 | `lib/clientesDrive.ts`, `components/ClientesPageClient.tsx` | Terminologia paciente/cliente; estrutura Drive |
| 19 | `sql/*.sql` (local) | Schemas Supabase: `clinica_medicos`, `onboarding_profiles.user_type`, `internal_*` |
| 20 | `public/favicon.svg`, `apple-icon.svg`, `app/globals.css` | Ícone e tema visual |

**ENV obrigatórios por deploy novo**

| Variável | Função no clone |
|----------|-----------------|
| `AUTH_URL` / `NEXTAUTH_URL` | Domínio canônico (deve bater com `CANONICAL_APP_HOST`) |
| `INTERNAL_PRODUCT_ID` | Slug em `internal_audit_log` / notas (`lib/internalProduct.ts`) |
| `ADMIN_EMAILS` | Allowlist do painel (trocar equipe) |
| `GOOGLE_CLIENT_*` | Client OAuth **novo** por domínio |
| `NEXT_PUBLIC_SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY` | Projeto Supabase **novo** |
| `ASAAS_*` | Conta Asaas do novo produto |
| `RESEND_*` | Domínio verificado do novo produto |

**Rotas fixas hoje (decidir se mantém obscuridade ou renomeia)**

- UI admin: `/naomexaaquiseucorno` (`ADMIN_PANEL_PATH`)
- API admin: `/api/naomexaaquiseucorno/*`
- Público: `/`, `/login`, `/planos`, `/privacidade`, `/termos`, `/f/[token]`, `/agendar/[slug]`, `/calendario/adicionar/[token]`

**Copy PT-BR espalhada:** dezenas de componentes em `components/*` e `app/dashboard/*` — após ajustar a “casca” (`constants`, landing, legal, planos), use Cursor em lotes por módulo (Agenda, Clientes, Financeiro, Comunicação).

---

## 3. Passo a passo: git clone → novo produto

### 3.1 Criar repositório vazio

```bash
# Na máquina de desenvolvimento
cd ~/projetos
git clone git@github.com:SEU_USER/medsupapp.git beauty-saas   # exemplo
cd beauty-saas
rm -rf .git
git init
git add .
git commit -m "chore: casca inicial a partir do MedSupAPP"
git remote add origin git@github.com:SEU_USER/beauty-saas.git
git push -u origin master
```

> **Importante:** `docs/`, `sql/`, `scripts/`, `AGENTS.md` estão no `.gitignore` do MedSupAPP — ao clonar só o GitHub você **não** leva essa pasta. Copie manualmente `docs/` e `sql/` da máquina fonte, ou ajuste `.gitignore` no novo repo se quiser versionar docs/SQL lá.

### 3.2 Renomear pacote e identidade mínima

1. `package.json` → `"name": "beauty-saas"` (ou similar)
2. `lib/constants.ts` → host, planos, cores
3. `lib/legal.ts` → e-mails e versões
4. `INTERNAL_PRODUCT_ID=beauty-saas` no `.env.example` / Vercel
5. `app/layout.tsx` → metadata + `lang`
6. Busca global: `MedSup`, `medsupapp`, `turquesaagenda.com.br` → substituir com revisão humana

### 3.3 Vercel (projeto novo)

1. [vercel.com](https://vercel.com) → **Add New Project** → importar o **novo** repo
2. Framework: Next.js (detectado)
3. Região: manter `sfo1` se público BR (como `vercel.json`)
4. Variáveis de ambiente: copiar estrutura de `.env.example` (valores **novos**, não os do MedSup)
5. Domínio customizado → atualizar `CANONICAL_APP_HOST`, `AUTH_URL`, redirects em `middleware.ts` e `vercel.json`
6. Primeiro deploy: `npm run build` local antes; depois push + promote conforme `docs/COMMIT_AND_DEPLOY.md` do **novo** projeto

### 3.4 Supabase (projeto novo)

1. Criar projeto em [supabase.com](https://supabase.com)
2. Copiar URL + anon + **service_role** para Vercel
3. Aplicar SQL na ordem (na pasta `sql/` local):

```bash
npm run db:operacional          # base operacional
npm run db:google-access
npm run db:agendamento
npm run db:clinica-medicos      # renomear/adaptar no vertical salão
npm run db:assinaturas
npm run db:assinaturas-policy
npm run db:internal
npm run db:internal-notes
npm run db:security             # security_hardening.sql
```

4. Conferir RLS e políticas em `docs/SECURITY-LGPD.md`

### 3.5 Google OAuth (client novo)

1. Google Cloud Console → projeto novo (ou app OAuth separado)
2. Tela de consentimento: nome do **novo** produto, domínio, política de privacidade URL pública
3. Redirect URIs: usar `GET /api/health/auth-config` no ambiente novo → registrar **todos** `googleRedirectUris`
4. Escopos: Calendar, Drive, Contacts (como MedSup) — ver `docs/GOOGLE_OAUTH_PRODUCAO.md`
5. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` só no servidor (Vercel)

### 3.6 Asaas, Resend, admin

| Serviço | Ação |
|---------|------|
| **Asaas** | Conta nova; webhook apontando para `https://SEU_DOMINIO/api/webhooks/asaas`; `ASAAS_WEBHOOK_TOKEN` |
| **Resend** | Domínio verificado; `RESEND_FROM=NomeProduto <noreply@...>` |
| **Admin** | `ADMIN_EMAILS` com e-mails da equipe; opcional: trocar `ADMIN_PANEL_PATH` |

---

## 4. O que copiar vs o que NÃO copiar

### Copiar (código e configs versionados)

- `app/`, `components/`, `lib/`, `auth.ts`, `middleware.ts`
- `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.*`, `vercel.json` (editar domínio)
- `.env.example` (sem segredos)
- `.githooks/` se usar o mesmo fluxo de deploy
- Pastas locais úteis: `docs/`, `sql/`, `scripts/` (cópia manual se continuarem no `.gitignore`)

### NÃO copiar / regenerar

| Item | Motivo |
|------|--------|
| `.env.local` | Segredos e URLs do produto antigo |
| `client_secret*.json` | Credencial Google baixada |
| `node_modules/` | Reinstalar com `npm ci` |
| `.next/` | Build artefato |
| Conta Vercel / domínio MedSup | Projeto isolado por marca |
| Projeto Supabase MedSup | Dados e RLS isolados |
| Client OAuth Google MedSup | Redirect URIs amarrados ao domínio |
| API keys Asaas / Resend produção | Cobrança e e-mail do tenant errado |
| Histórico git com segredos | Se existiu leak, usar `bfg` / repo limpo |

---

## 5. Estratégia “casca” (shell template)

Mantenha o **core técnico** estável (auth Google, middleware, Drive, webhook Asaas, agendamento público, admin 404) e concentre o vertical nas poucas fontes abaixo — é onde o Cursor rende mais.

### Fontes primárias (editar primeiro)

```
lib/constants.ts       # domínio, PLANOS, CORES, labels
lib/subscriptionPlans.ts
lib/legal.ts
lib/asaasBillingPolicy.ts   # trial/dias (ajustar se pricing diferente)
.env.example
app/layout.tsx
components/LandingPageContent.tsx
app/planos/page.tsx
```

### Segunda onda (vertical forte)

```
app/onboarding/page.tsx
app/dashboard/perfil/page.tsx
lib/mensagemTemplate.ts
components/MensagemTemplateEditor.tsx
sql/clinica_medicos_schema.sql   → evoluir para "profissionais" ilimitados no salão
```

### Terceira onda (polish)

- Componentes de agenda/clientes/financeiro (substituir “paciente”, “consulta”, “CRM”)
- E-mails em `lib/email.ts`
- Ícones em `public/`

---

## 6. Workflow Cursor AI pós-clone

### 6.1 Preparar contexto

1. Manter/copiar `AGENTS.md` e `CLAUDE.md` (regras Next.js 16 + deploy)
2. Atualizar `project_summary.txt` com nome, domínio, planos e rotas do **novo** produto
3. Criar regra em `.cursor/rules/` opcional: “Vertical: salão de beleza; profissionais ilimitados; PT-BR; não reativar API WhatsApp Meta”

### 6.2 Ordem sugerida de prompts (Composer / Agent)

**Prompt A — Rebrand casca**

```
Leia project_summary.txt e lib/constants.ts.
Objetivo: rebrand para [NOME_PRODUTO], domínio [DOMINIO], cores [HEX].
Atualize: constants.ts (PLANOS, CORES, CANONICAL_APP_HOST), legal.ts, layout metadata,
LandingPageContent, email.ts subjects, asaasConta descriptions, package.json name.
Não altere lógica de webhook Asaas nem middleware de auth.
Liste arquivos tocados.
```

**Prompt B — Planos salão (exemplo)**

```
Em subscriptionPlans.ts e constants PLANOS:
- Remover limite de profissionais (ou cap alto fixo 999).
- Planos: Solo R$X, Salão até 3 profissionais R$Y, Salão ilimitado R$Z.
- planToUserType: mapear para 'solo' | 'salao' e ajustar onboarding user_type.
Atualizar textos de downgrade. Manter IDs Asaas estáveis ou documentar migração.
```

**Prompt C — Onboarding vertical**

```
onboarding/page.tsx: trocar CRM/especialidade por profissão/serviços;
manter endereço e WhatsApp; CNPJ opcional para MEI salão.
Manter fluxo Google + OTP existente.
```

**Prompt D — Copy por módulo**

```
Módulo: [Agenda | Clientes | Financeiro | Comunicação].
Substituir terminologia médica por [cliente final / profissional / serviço / sessão].
Manter chaves de API e nomes de tabelas Supabase até segunda rodada de migração SQL.
```

**Prompt E — US English (fase 2)**

```
i18n mínimo: lang=en-US em layout; extrair strings visíveis do Header e Landing para um mapa EN;
formatCurrency USD; máscaras telefone US; revisar legal pages (consultar advogado US).
Não traduzir nomes de colunas SQL nesta fase.
```

### 6.3 Verificação após cada sessão Cursor

```bash
npm run build
# smoke manual: login Google, OTP, onboarding, /api/health/auth-config
```

---

## 7. Matriz de fork por vertical

| Dimensão | MedSupAPP (atual) | Salão de beleza (próximo) | US English (depois) |
|----------|-------------------|---------------------------|---------------------|
| **Público** | Médico solo + clínica 2–10 | Salão / estúdio; **profissionais ilimitados** no plano topo | Salons / clinics; HIPAA-aware copy (advogado) |
| **Planos** | `medico-pix`, `clinica-5-pix`, `clinica-10-pix` | Ex.: `solo`, `salao-3`, `salao-ilimitado` — preço menor, sem tier por “médico” | USD; impostos; Stripe ou Asaas US se disponível |
| **Equipe** | `clinica_medicos` com cap | Remover cap ou tabela `salao_profissionais` | Mesma lógica, labels EN |
| **Onboarding** | CRM, especialidade, CNPJ | Profissão, serviços, chair/station | EIN opcional; endereço US |
| **Cliente final** | Paciente | Cliente | Client |
| **Agenda** | Consulta / retorno / exame | Sessão / serviço / pacote | Appointment / service |
| **LGPD** | `/privacidade`, Drive do profissional | Atualizar controlador/operador | Privacy Policy + Terms US |
| **WhatsApp** | wa.me + templates PT | Igual (BR) | SMS/email alternativo se US |
| **Google** | Igual | Igual | Igual |
| **Asaas** | PIX/boleto BR | Mesmo padrão webhook | Avaliar Stripe + webhook paralelo |
| **Admin** | `INTERNAL_PRODUCT_ID=turquesa-agenda` | `beauty-saas` (ex.) | `product-us` |
| **Core a reutilizar** | Auth, middleware, Drive sync, agendamento público, admin 404, padrão webhook | ~90% código; mudar casca + limites + copy | + i18n + legal + moeda |

---

## 8. `INTERNAL_PRODUCT_ID` e tabelas `internal_*`

O painel admin já grava `product_id` em:

- `internal_audit_log` (default SQL `'medsupapp'`)
- `internal_tenant_notes`
- respostas API em `/api/naomexaaquiseucorno/*`

Código: `lib/internalProduct.ts` lê `process.env.INTERNAL_PRODUCT_ID` (fallback `medsupapp`).

**Uso por clone:** cada deploy/Vercel project com `INTERNAL_PRODUCT_ID` **único** (ex. `beauty-saas`). Assim, se no futuro um mesmo Supabase servir mais de um produto (não recomendado no início), os logs internos não se misturam.

**Recomendação inicial:** 1 Supabase por produto + 1 `INTERNAL_PRODUCT_ID` — simples e alinhado ao isolamento LGPD.

---

## 9. Monorepo vs repositórios separados

### Recomendação para este momento: **repositórios separados** (clone completo)

| Critério | Repositórios separados | Monorepo (`apps/medsup`, `apps/beauty`, `packages/core`) |
|----------|------------------------|----------------------------------------------------------|
| Curva para 1º SaaS AI-built | Baixa: fork, env novo, deploy | Alta: extrair pacote compartilhado, CI matrix |
| Domínio / Vercel / Supabase / OAuth | Naturalmente isolados | Possível, mas config por app anyway |
| Copy e planos por vertical | Liberdade total por repo | Exige abstrações prematuras |
| Bugfix no core | Cherry-pick ou sync manual | Um PR beneficia todos |
| Risco de vazar segredo MedSup no salão | Menor | Maior se `.env` compartilhado |

**Quando considerar monorepo:** depois de 2–3 verticais estáveis, quando bugfixes em `lib/asaasWebhookHandler.ts` e `middleware.ts` forem frequentes e idênticos — aí extrair `packages/saas-core` com versão semver.

**Até lá:** trate o MedSupAPP versionado no GitHub como **template golden**; cada vertical = repo + Vercel + Supabase + Google OAuth + Asaas próprios; copie `docs/` e `sql/` da máquina local.

---

## 10. Checklist rápido pós-clone (novo vertical)

- [ ] `npm ci` && `npm run build`
- [ ] `.env.local` preenchido (nenhum segredo do MedSup)
- [ ] Supabase schemas aplicados + `security_hardening.sql`
- [ ] Google OAuth: redirects + tela de consentimento publicados
- [ ] Vercel Production: `AUTH_URL`, `ASAAS_BILLING_ENFORCED` conforme fase
- [ ] `INTERNAL_PRODUCT_ID` e `ADMIN_EMAILS` definidos
- [ ] Landing + planos + legal revisados por humano
- [ ] Checklist seção 1 deste doc executado no novo domínio
- [ ] Primeiro usuário real: login → OTP → onboarding → Google sync → agendamento teste

---

## 11. Referência de comandos

```bash
npm run dev
npm run build
npm run db:operacional
npm run test:billing
curl -sS https://SEU_DOMINIO/api/health/auth-config
```

Documentação irmã: `docs/README.md` (índice).
