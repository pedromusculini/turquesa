# Supabase — desenvolvimento local (Turquesa Agenda)

Guia para conectar o projeto Supabase **"Turquesa Agenda"** ao app rodando em `http://localhost:3000`, **sem** Vercel nem domínio de produção.

**Nunca commitar** `.env.local`, chaves `service_role` nem tokens pessoais.

Ver também: `docs/DEV_LOCAL.md` (bypass de auth), `.env.example` (template).

---

## 1. Projeto no Supabase

1. [supabase.com/dashboard](https://supabase.com/dashboard) → projeto **Turquesa Agenda** (ou crie um novo).
2. Anote o **Project URL** e as chaves em **Project Settings → API**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / publishable** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** (secret) → `SUPABASE_SERVICE_ROLE_KEY` — só servidor; não expor no front.

3. **Token para scripts `npm run db:*`** (Management API):
   - **Account** (ícone do usuário) → **Access Tokens** → gere um token.
   - Cole em `.env.local` como `SUPABASE_ACCESS_TOKEN`.
   - Sem esse token, os scripts `db:*` falham com erro pedindo `SUPABASE_ACCESS_TOKEN`.

---

## 2. Arquivo `.env.local`

Na raiz do repositório:

```bash
cp .env.example .env.local
```

Preencha pelo menos (valores reais só no arquivo local):

| Variável | Onde obter | Uso local |
|----------|-----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard → API | App + scripts `db:*` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dashboard → API | Cliente browser / rotas com anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard → API (secret) | APIs server-side |
| `SUPABASE_ACCESS_TOKEN` | Account → Access Tokens | `npm run db:*` |
| `AUTH_SECRET` | `openssl rand -base64 32` | Sessão Auth.js / bypass |
| `AUTH_URL` / `NEXTAUTH_URL` | Fixo | `http://localhost:3000` |

**Opcional — UI sem Google/OTP** (`docs/DEV_LOCAL.md`):

```env
DEV_BYPASS_AUTH=true
AUTH_SECRET=sua-string-longa-aleatoria
```

**Opcional — dados no Supabase amarrados a um usuário de teste:**

```env
DEV_BYPASS_EMAIL=seu@gmail.com
DEV_BYPASS_GOOGLE_SUB=...
```

Gere `AUTH_SECRET` (PowerShell ou Git Bash):

```bash
openssl rand -base64 32
```

---

## 3. O que **não** configurar agora (só local)

| Não definir / não usar ainda | Motivo |
|------------------------------|--------|
| Variáveis na **Vercel** | Deploy fora do escopo |
| `AUTH_URL` / `NEXTAUTH_URL` de produção (`https://www.turquesaagenda.com.br`) | OAuth e cookies quebram no localhost |
| `VERCEL_*`, `CRON_SECRET` de produção | Crons e deploy |
| `ASAAS_*` em produção ou `ASAAS_BILLING_ENFORCED=true` | Cobrança; em local use `false` ou omita (ver `.env.example`) |
| `WHATSAPP_*` / Meta Cloud API | Produto usa wa.me; rotas `/api/whatsapp/*` desativadas por padrão |
| `RESEND_*` | Só necessário para OTP real por e-mail |
| `GOOGLE_CLIENT_*` | Pode pular com `DEV_BYPASS_AUTH=true` |
| `DEV_BYPASS_AUTH=true` em qualquer ambiente Vercel | Bloqueado em Production; ver `DEV_LOCAL.md` |

---

## 4. Google OAuth (quando for testar login real)

Pule esta seção se usar **bypass** (`DEV_BYPASS_AUTH=true`).

1. [Google Cloud Console](https://console.cloud.google.com) → OAuth client (Web).
2. **Authorized redirect URIs:** `http://localhost:3000/api/auth/callback/google` (e rotas incrementais do app, se usar escopos Drive/Calendar).
3. Copie para `.env.local`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (aliases aceitos: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`).

---

## 5. Pasta `sql/` e scripts `db:*`

Os arquivos ficam em `sql/` (gitignored no clone público; presentes no seu workspace). Os scripts leem `.env.local` e aplicam SQL via **Supabase Management API** (`scripts/apply-sql-file.mjs`).

### 5.1 Arquivos SQL (inventário)

| Arquivo | Script npm | Observação |
|---------|------------|------------|
| `operacional_schema.sql` | `db:operacional` | Formulários públicos + fila WhatsApp |
| `onboarding_profiles_schema.sql` | — | **Base** — rodar no SQL Editor primeiro |
| `onboarding_profiles_schema_v2.sql` | — | Colunas de endereço (após base) |
| `verification_codes_schema.sql` | — | OTP e-mail (login real) |
| `google_account_access_schema.sql` | `db:google-access` | Trial / vínculo Google |
| `clinica_medicos_schema.sql` | `db:clinica-medicos` | Equipe / profissionais |
| `security_hardening.sql` | `db:security` | RLS (após `verification_codes`) |
| `consultas_whatsapp_schema.sql` | `db:consultas-whatsapp` | Opcional (legado Meta) |
| `agendamento_semi_manual_schema.sql` | `db:agendamento` | Slugs, disponibilidade, tokens |
| `clientes_schema.sql` | — | Módulo clientes no Supabase |
| `financeiro_schema.sql` | — | Tabela `financeiro_transacoes` (antes do profissional) |
| `servicos_catalogo_schema.sql` | `db:catalogo` | Catálogo de serviços |
| `servicos_catalogo_fotos_schema.sql` | `db:catalogo-fotos` | Constraint `foto_urls` |
| `config_pagamento_schema.sql` | `db:config-pagamento` | Taxas e repasse |
| `financeiro_profissional_schema.sql` | `db:financeiro-profissional` | Colunas de comissão |
| `assinaturas_schema.sql` | `db:assinaturas` | Cobrança Asaas |
| `assinaturas_billing_policy_columns.sql` | `db:assinaturas-policy` | Política de billing |
| `internal_platform_schema.sql` | `db:internal` | Painel interno |
| `internal_tenant_notes_schema.sql` | `db:internal-notes` | Notas suporte |
| `add_address_columns_to_profiles.sql` | — | Alternativa pontual a v2 |
| `lembretes_config_columns.sql` | — | Colunas de lembrete (se usar) |
| `seed_webhook_test_owner.sql` | — | Só testes de webhook |

### 5.2 Ordem recomendada (Turquesa Agenda)

**A — SQL Editor** (Dashboard → SQL → New query → colar arquivo → Run), nesta ordem:

1. `onboarding_profiles_schema.sql`
2. `onboarding_profiles_schema_v2.sql`
3. `verification_codes_schema.sql` — omitir se só bypass e sem OTP
4. `clientes_schema.sql` — se for usar Clientes no Supabase (não só Drive)
5. `financeiro_schema.sql` — **obrigatório** antes de `db:financeiro-profissional`

**B — Terminal** (na raiz, com `.env.local` preenchido):

```bash
npm run db:operacional
npm run db:google-access
npm run db:clinica-medicos
npm run db:security
npm run db:agendamento
npm run db:catalogo
npm run db:catalogo-fotos
npm run db:config-pagamento
npm run db:financeiro-profissional
```

**C — Opcional**

```bash
npm run db:consultas-whatsapp    # só se for testar schema WhatsApp legado
npm run db:assinaturas
npm run db:assinaturas-policy      # após assinaturas; local com ASAAS_BILLING_ENFORCED=false
npm run db:internal
npm run db:internal-notes          # requer ADMIN_EMAILS no .env.local para painel interno
```

**D — Verificação rápida**

```bash
npm run setup:supabase
```

Confere tabelas operacionais (`formulario_links`, etc.). Se falhar, aplique `operacional_schema.sql` no Editor ou `npm run db:operacional`.

### 5.3 Perfil mínimo só com bypass (UI + navegação)

- `.env.local` com Supabase URL + anon + service role + `AUTH_SECRET` + `DEV_BYPASS_AUTH=true`
- Pode **adiar** quase todo o bloco B/C até abrir módulos que quebram sem tabela (ex.: catálogo → `db:catalogo` + bucket; financeiro → `financeiro_schema.sql` + `db:config-pagamento` + `db:financeiro-profissional`).

---

## 6. Storage — bucket `catalogo-fotos` (público)

Necessário para upload de fotos do catálogo (`lib/catalogoFotos.ts`, `docs/CATALOGO_FOTOS_ARMAZENAMENTO.md`).

1. Dashboard → **Storage** → **New bucket**
2. Nome: `catalogo-fotos`
3. **Public bucket:** ativado (leitura pública das imagens na vitrine `/f/[token]`)
4. Políticas: o app usa **service role** no upload; em dev, o bucket público basta para URLs `.../storage/v1/object/public/catalogo-fotos/...`

Depois rode (se ainda não rodou):

```bash
npm run db:catalogo
npm run db:catalogo-fotos
```

MIME aceitos na API: JPEG, PNG, WebP (armazenamento otimizado WebP no servidor).

---

## 7. Subir o app

```bash
npm install
npm run dev
# ou, com bypass sem editar .env:
npm run dev:bypass
```

Abra `http://localhost:3000/dashboard`.

---

## 8. Checklist rápido

- [ ] Projeto Supabase criado; URL + anon + service_role no `.env.local`
- [ ] `SUPABASE_ACCESS_TOKEN` para `npm run db:*`
- [ ] `AUTH_SECRET` definido; opcional `DEV_BYPASS_AUTH=true`
- [ ] `AUTH_URL` / `NEXTAUTH_URL` = `http://localhost:3000`
- [ ] SQL base: `onboarding_profiles` (+ v2) no Editor
- [ ] Scripts B na ordem acima (ou sob demanda por módulo)
- [ ] Bucket **`catalogo-fotos`** público + `db:catalogo` / `db:catalogo-fotos`
- [ ] `npm run setup:supabase` OK (operacional)
- [ ] **Não** commitar `.env.local` nem colar secrets no chat

---

## 9. Troubleshooting

| Sintoma | Ação |
|---------|------|
| `Defina SUPABASE_ACCESS_TOKEN` | Token em Account → Access Tokens |
| `relation "onboarding_profiles" does not exist` | Rodar `onboarding_profiles_schema.sql` no Editor |
| Erro em `db:financeiro-profissional` | Rodar `financeiro_schema.sql` antes |
| `db:clinica-medicos` falha FK | `onboarding_profiles` já criada |
| `db:security` / RLS estranho | Rodar após `verification_codes_schema.sql` |
| Upload catálogo 404 / bucket | Criar bucket público `catalogo-fotos` |
| Config pagamento 503 | `npm run db:config-pagamento` |
| Sessão vazia com bypass | `AUTH_SECRET` definido e servidor reiniciado |


---

## 10. Aplicado local (workspace)

**Data:** 2026-06-03  
**Project ref:** `xzujpefaifxrxyjmkrhw` (de `NEXT_PUBLIC_SUPABASE_URL`)  
**Status:** SQL aplicado via Management API (`SUPABASE_ACCESS_TOKEN` + `npm run db:*` / `apply-sql-file.mjs`).

### SQL base (apply-sql-file / Editor)

- `onboarding_profiles_schema.sql`, `onboarding_profiles_schema_v2.sql`
- `verification_codes_schema.sql`, `clientes_schema.sql`, `financeiro_schema.sql`

### Scripts npm (sucesso)

- `db:operacional`, `db:google-access`, `db:clinica-medicos`, `db:security`
- `db:consultas-whatsapp` → depois `db:agendamento` (agendamento altera `consultas_agenda`)
- `db:catalogo`, `db:catalogo-fotos`, `db:config-pagamento`, `db:financeiro-profissional`
- `db:assinaturas`, `db:assinaturas-policy`, `db:internal`, `db:internal-notes`

### Verificação

```bash
npm run setup:supabase
```

Resultado esperado: `formulario_links`, `formulario_respostas`, `whatsapp_fila` OK.

### Storage (ação manual)

Criar no Dashboard → Storage → bucket público **`catalogo-fotos`** (ver §6). Necessário para upload do catálogo após `db:catalogo`.

### Tabelas principais (referência)

`onboarding_profiles`, `verification_codes`, `google_account_access`, `clinica_medicos`, `clientes` (módulo), `financeiro_transacoes`, `servicos_catalogo`, `config_pagamento`, `formulario_links`, `formulario_respostas`, `whatsapp_fila`, `consultas_agenda`, `agenda_disponibilidade`, `agendamento_slugs`, `assinaturas`, tabelas `internal_*`.
