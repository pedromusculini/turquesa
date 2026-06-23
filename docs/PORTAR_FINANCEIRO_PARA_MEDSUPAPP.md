# Portar financeiro (taxas + repasse) — Turquesa → MedSupAPP

Checklist para trazer **meios de pagamento/taxas**, **% profissional/médico** e **repasse financeiro** do repositório **Turquesa Agenda** para **MedSupAPP** (outra janela Cursor).

| Projeto | Caminho local |
|---------|----------------|
| Origem (implementado) | `c:\Users\pedro\OneDrive\Documents\turquesaagenda` |
| Destino | `c:\Users\pedro\OneDrive\Documents\medsupapp` |

Regras de negócio: `docs/REGRAS_FINANCEIRO.md` (no Turquesa; copiar ou resumir no MedSup se `docs/` estiver ignorado lá também).

---

## 1. Commits Git (referência)

Histórico relevante no Turquesa (após bootstrap `5a0c808`):

| Hash | Data | Mensagem | Escopo financeiro |
|------|------|----------|-------------------|
| `923b9c0` | 2026-06-03 | feat: salão — catálogo, atendimento, financeiro profissional e taxas pagamento | **Principal:** SQL, `lib/configPagamento`, `registrarEntradaFinanceira`, APIs, modais, aba Repasse, `ConfigPagamentoSection` (mistura com catálogo/rebrand) |
| `f799e6a` | 2026-06-03 | fix: remove dinheiro/transferência e erro fetch config pagamento | Dev fallback (`devConfigPagamentoStore`), `supabaseErrors`, robustez GET/POST `/api/config/pagamento`, `sanitizeConfigPagamento` |
| `2a6d6e1` | 2026-06-03 | fix: meios de pagamento em menu Configurações | `ConfiguracoesSubNav`, rota `/dashboard/configuracoes/pagamento`, layout config |

Commits **não** financeiros no mesmo período (evitar cherry-pick cego): `519551a`, `44359ae`, `22aa188`, `08ce345`, portfólio, etc.

### Cherry-pick vs cópia manual

- O MedSupAPP **não compartilha** o histórico dos commits acima (`923b9c0` não existe no `git log` do medsupapp).
- **Não use** `git cherry-pick 923b9c0` direto no medsupapp — o commit é grande (catálogo, landing, perfil salão).
- **Recomendado:** copiar/diffar arquivos listados na seção 2 a partir do Turquesa, ou gerar patch por caminho:

```bash
cd "c:/Users/pedro/OneDrive/Documents/turquesaagenda"
git show 923b9c0 --stat
git diff 5a0c808..2a6d6e1 -- lib/configPagamento.ts lib/registrarEntradaFinanceira.ts \
  app/api/config/pagamento app/api/financeiro sql/config_pagamento_schema.sql \
  sql/financeiro_profissional_schema.sql
```

Ordem lógica se um dia os repositórios tiverem ancestral comum: `923b9c0` → `f799e6a` → `2a6d6e1`.

---

## 2. Lista de arquivos (por grupo)

### 2.1 Core — config pagamento e erros

| Arquivo | Ação no MedSup |
|---------|----------------|
| `lib/configPagamento.ts` | **Criar** — tipos, defaults, `calcularTaxaPagamento`, `calcularRepasseProfissional`, `metodoIdFromForma`, `sanitizeConfigPagamento` |
| `lib/devConfigPagamentoStore.ts` | **Criar** — cache em memória quando `DEV_BYPASS_AUTH` / colunas SQL ausentes |
| `lib/supabaseErrors.ts` | **Criar** ou mesclar — `isSupabaseMissingColumnError`, `supabaseErrorStatus`, mensagens 503 |
| `lib/registrarEntradaFinanceira.ts` | **Criar** — insert em `financeiro_transacoes` com bruto/taxa/líquido/repasse; `percentualProfissionalPadrao`, `ultimoPercentualProfissional` |

Dependências: `lib/supabaseClient.ts`, tabela `onboarding_profiles`, `clinica_medicos`, `financeiro_transacoes`.

### 2.2 API — config e financeiro

| Arquivo | Notas |
|---------|--------|
| `app/api/config/pagamento/route.ts` | GET/PUT `config_pagamento_metodos` + `repassar_custo_profissional`; dev fallback |
| `app/api/financeiro/route.ts` | POST entrada com `medico` + `percentual_profissional` → `registrarEntradaFinanceira`; GET já retorna colunas novas |
| `app/api/financeiro/percentual-profissional/route.ts` | **Criar** — GET `?medico=` → último uso ou `percentual_comissao` da equipe |

### 2.3 UI — Configurações

| Arquivo | Notas |
|---------|--------|
| `components/ConfigPagamentoSection.tsx` | Formulário taxas PIX/débito/crédito 1x–12x + toggle “Repassar custo…” |
| `components/ConfiguracoesSubNav.tsx` | **Criar** — aba “Pagamento e taxas” |
| `app/dashboard/configuracoes/pagamento/page.tsx` | **Criar** |
| `app/dashboard/configuracoes/layout.tsx` | Shell com voltar ao Dashboard (commit `2a6d6e1`) |
| `app/dashboard/configuracoes/page.tsx` | Integrar `ConfiguracoesSubNav` (hoje só mensagens no MedSup) |
| `components/ComunicacaoClient.tsx` | Incluir `ConfiguracoesSubNav` nas telas de config |

### 2.4 UI — Atendimento / agenda / clientes

| Arquivo | MedSup (terminologia médica) |
|---------|------------------------------|
| `components/FinalizarConsultaModal.tsx` | **Atualizar** — campo comissão %, fetch `/api/financeiro/percentual-profissional`, payload `percentualProfissional` (Turquesa já tem; MedSup ainda não) |
| `components/FinalizarAtendimentoModal.tsx` | Só no Turquesa (salão). No MedSup: manter `FinalizarConsultaModal` + fluxo clientes equivalente |
| `components/MedicoSelect.tsx` | Labels: no MedSup usar “Médico” / “Selecione o médico” (Turquesa usa “Profissional”) |
| `app/api/clientes/atendimento-avulso/route.ts` | Chamar `registrarEntradaFinanceira` + validar `forma_pagamento` |
| `app/api/clientes/[id]/finalizar/route.ts` | Mesmas validações de forma de pagamento (se existir no MedSup) |
| `components/AgendaPageClient.tsx` | Enviar `forma_pagamento`, `parcelas`, `percentual_profissional` ao finalizar |
| `components/DashboardAgendaHoje.tsx` | Idem agenda hoje |
| `components/ClientesPageClient.tsx` | Payload atendimento avulso com % profissional (Turquesa usa `FinalizarAtendimentoModal`) |

### 2.5 UI — Financeiro

| Arquivo | Notas |
|---------|--------|
| `components/FinanceiroPageClient.tsx` | `viewMode` `transacoes` \| `repasse`; tabela bruto/taxa/líquido/parte médico/salão; copy “clínica” no MedSup |

### 2.6 Lib / API auxiliares (diff pequeno, revisar)

| Arquivo | Mudança típica |
|---------|----------------|
| `lib/atendimentoFinalizar.ts` | `FORMAS_PAGAMENTO_ATENDIMENTO` alinhado a `configPagamento` (sem dinheiro/transferência após `f799e6a`) |
| `lib/consultations.ts` | `FORMAS_PAGAMENTO_CONSULTA`, tipos de payload finalizar consulta |
| `lib/constants.ts` | Remover formas descontinuadas se duplicadas |
| `app/api/perfil/medicos/route.ts` | Persistir `percentual_comissao` (default 50) |
| `package.json` | Scripts `db:config-pagamento` e `db:financeiro-profissional` |

### 2.7 SQL

| Arquivo | `npm run` |
|---------|-----------|
| `sql/config_pagamento_schema.sql` | `db:config-pagamento` |
| `sql/financeiro_profissional_schema.sql` | `db:financeiro-profissional` |

Colunas principais:

- `onboarding_profiles`: `config_pagamento_metodos` (JSONB), `repassar_custo_profissional` (boolean)
- `clinica_medicos`: `percentual_comissao` (0–100)
- `financeiro_transacoes`: `forma_pagamento`, `parcelas`, `valor_bruto`, `taxa_pagamento`, `valor_liquido`, `percentual_profissional`, `valor_profissional`, `valor_salao`, `repassar_custo`

---

## 3. SQL e comandos npm

No projeto destino, após copiar os `.sql` e scripts do `package.json`:

```bash
cd "c:/Users/pedro/OneDrive/Documents/medsupapp"

# Colunas de config (perfil do tenant)
npm run db:config-pagamento

# Colunas de repasse nas transações
npm run db:financeiro-profissional
```

Requer `SUPABASE_URL` + service role (mesmo padrão dos outros `db:*` em `scripts/apply-sql-file.mjs`).

Validação rápida no Supabase SQL editor:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'financeiro_transacoes'
  AND column_name IN ('valor_bruto', 'taxa_pagamento', 'valor_profissional');
```

Build após código:

```bash
npm run build
```

---

## 4. Ordem de implementação sugerida

1. **SQL** — `config_pagamento` → `financeiro_profissional` no Supabase do MedSup.
2. **Lib** — `configPagamento.ts` → `registrarEntradaFinanceira.ts` → `supabaseErrors.ts` + `devConfigPagamentoStore.ts`.
3. **API** — `/api/config/pagamento` → `/api/financeiro/percentual-profissional` → ajustar POST/GET em `/api/financeiro`.
4. **package.json** — adicionar scripts `db:config-pagamento` e `db:financeiro-profissional`.
5. **Config UI** — `ConfigPagamentoSection`, `ConfiguracoesSubNav`, página `configuracoes/pagamento`, wire em `ComunicacaoClient` / `configuracoes/page`.
6. **Perfil equipe** — `app/api/perfil/medicos` com `percentual_comissao` (UI equipe opcional; modais já usam API de percentual).
7. **Finalizar atendimento** — `FinalizarConsultaModal`, `AgendaPageClient`, `DashboardAgendaHoje`, `atendimento-avulso`, `clientes/[id]/finalizar`.
8. **Financeiro** — aba “Repasse profissionais/médicos” em `FinanceiroPageClient`.
9. **Teste manual** — configurar taxas → finalizar consulta com cartão parcelado → conferir linha no Financeiro → aba Repasse.
10. **Build + deploy** — `npm run build`, commit, release conforme `docs/COMMIT_AND_DEPLOY.md` do MedSup.

---

## 5. Prompt pronto (colar no Cursor — MedSupAPP)

```text
Objetivo: portar do Turquesa Agenda (c:\Users\pedro\OneDrive\Documents\turquesaagenda) o módulo financeiro de taxas de pagamento e repasse ao médico/clínica. Manter terminologia MÉDICA (paciente, médico, consulta, clínica). Não alterar webhook Asaas nem middleware de auth.

Referência de regras: no Turquesa, docs/REGRAS_FINANCEIRO.md — fórmula: bruto → (opcional) taxa do meio se repassar_custo_profissional → líquido → % médico → resto clínica.

Implementar nesta ordem:
1) Copiar/adaptar sql/config_pagamento_schema.sql e sql/financeiro_profissional_schema.sql; adicionar em package.json: db:config-pagamento e db:financeiro-profissional; rodar npm run db:config-pagamento && npm run db:financeiro-profissional no Supabase deste projeto.
2) Criar lib/configPagamento.ts, lib/registrarEntradaFinanceira.ts, lib/devConfigPagamentoStore.ts, lib/supabaseErrors.ts (como no Turquesa commits 923b9c0 + f799e6a).
3) Criar app/api/config/pagamento/route.ts e app/api/financeiro/percentual-profissional/route.ts; atualizar app/api/financeiro/route.ts para entradas com medico + percentual_profissional usarem registrarEntradaFinanceira.
4) UI Configurações: components/ConfigPagamentoSection.tsx, ConfiguracoesSubNav.tsx, app/dashboard/configuracoes/pagamento/page.tsx e layout; integrar subnav na página de configurações/comunicação.
5) Finalizar consulta/atendimento: atualizar components/FinalizarConsultaModal.tsx (campo Comissão do médico %, fetch GET /api/financeiro/percentual-profissional?medico=), AgendaPageClient, DashboardAgendaHoje, app/api/clientes/atendimento-avulso/route.ts — enviar forma_pagamento, parcelas, percentual_profissional.
6) components/FinanceiroPageClient.tsx: aba "Repasse médicos" com colunas bruto, taxa, líquido, parte médico, parte clínica (filtrar entradas por período/médico).
7) app/api/perfil/medicos/route.ts: suportar percentual_comissao na equipe.
8) Labels MedicoSelect: "Médico" / clínica, não "Profissional/salão".
9) npm run build e corrigir erros TypeScript.

Arquivos fonte no Turquesa (diff vs bootstrap 5a0c808): ver docs/PORTAR_FINANCEIRO_PARA_MEDSUPAPP.md seção 2. Não portar catálogo, landing salão nem rotas WhatsApp.

Teste: Configurações → Pagamento e taxas (salvar PIX 0, crédito 3%); Meu Perfil equipe com comissão 60%; finalizar consulta R$100 cartão 1x médico X com 60%; Financeiro → Repasse deve mostrar taxa e split coerentes.
```

---

## 6. Adaptações MedSup vs Turquesa

| Turquesa (salão) | MedSup (médico) |
|------------------|-----------------|
| Profissional / salão | Médico / clínica |
| `FinalizarAtendimentoModal` | `FinalizarConsultaModal` |
| “Repasse profissionais” | “Repasse médicos” (ou “Repasse da equipe”) |
| Tabelas SQL `clinica_medicos` | **Manter** nome da tabela (sem migração de rename) |

O núcleo (`configPagamento`, `registrarEntradaFinanceira`, colunas SQL) é **vertical-agnóstico**; só copy e rotas de UI precisam de labels médicos.

---

## 7. Verificação pós-port

- [ ] `GET /api/config/pagamento` retorna `config` + `repassar_custo_profissional` (sem 500 por coluna ausente após migration).
- [ ] Salvar taxas na UI persiste após reload.
- [ ] Finalizar consulta preenche % do médico via API.
- [ ] Nova entrada em Financeiro tem `valor_bruto`, `taxa_pagamento`, `valor_profissional`, `valor_salao`.
- [ ] Aba Repasse agrega por médico no período.
- [ ] `npm run build` verde.

---

*Gerado a partir do estado Turquesa Agenda em 2026-06-03 (commits `923b9c0`, `f799e6a`, `2a6d6e1`).*
