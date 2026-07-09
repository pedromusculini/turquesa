# Funcionalidades do Turquesa Agenda

Visão geral dos módulos em produção. Vertical: **salão / estúdio de beleza** (PT-BR).

**Última atualização:** 2026-07-07

## Plano e cobrança

- **Um plano:** `ilimitado` — R$ 79,90/mês, trial 30 dias, até 999 profissionais
- Cobrança **Asaas** (PIX, cartão, boleto); webhook libera +30 dias por pagamento
- Bloqueio de rotas quando assinatura expirada (`ASAAS_BILLING_ENFORCED`)
- Detalhes: [ASAAS_BILLING.md](./ASAAS_BILLING.md)

## Autenticação e onboarding

- Login **somente Google** (escopos Calendar + Drive no fluxo inicial)
- Verificação de e-mail (código OTP via Resend) e trial
- **Onboarding** (`/onboarding`): profissão, serviços, endereço, WhatsApp, CNPJ opcional
- **Perfil** (`/dashboard/perfil`): dados do salão, equipe, convite de agenda Google por profissional
- **Configurações** (`/dashboard/configuracoes`):
  - Meios de pagamento e taxas (repasse)
  - Equipe (`/dashboard/configuracoes/equipe`)
  - Agenda (duração padrão, janela)
  - Anamnese / ficha do cliente
  - Segurança (PIN financeiro em modo salão)

## Dashboard (`/dashboard`)

- **Agenda de hoje** — sessões do dia; finalizar atendimento com catálogo e pagamento
- **Atendimento avulso** — atalho para `/clientes?finalizar=1`
- **Google — conectar e sincronizar** (`GoogleIntegracaoCard`): Drive, Calendar, Contatos; importações adiadas no idle
- **Lembretes WhatsApp** — lista D-7 e D-1; envio manual via wa.me (sem API Meta)
- Link de **autocadastro** de clientes
- Instalar app / PWA

## Agenda (`/agenda`)

- Sessões em `localStorage` + sync **Supabase** (`consultas_agenda`) + opcional **Google Calendar**
- Janela local: 6 meses passado + 12 futuro
- **Nova sessão:** busca de cliente (`PacienteSearchField`), WhatsApp, profissional, lembretes
- **Modal na grade:** editar horário, cliente, serviço, republicar no Google
- **Finalizar sessão:** modal com itens do catálogo, desconto, forma de pagamento, comissão → financeiro + histórico do cliente
- **Sessões pendentes** (sidebar): atalho para finalizar; badge de status só para **Finalizada**, **Cancelada** ou **Faltou**
- Sync manual completo (botão) inclui Google; ao **voltar para a aba** usa refresh leve (sem Google automático, cooldown ~45s)
- Após sync completo, grava **snapshot diário da agenda** no Drive (ver [Backup](#backup-backup))
- **Mobile:** lista semanal padrão; **desktop:** grade dia/semana

### Status da sessão (modelo salão — jun/2026)

Herança do template médico foi **simplificada na UI**:

| Status interno | Significado | Badge na UI |
|----------------|-------------|-------------|
| `confirmado` (padrão novo) | Sessão aberta / agendada | *(oculto)* |
| `agendado` (legado) | Igual “aberta” | *(oculto)* |
| `realizado` | Finalizada com pagamento | **Finalizada** |
| `cancelado` | Cancelada | **Cancelada** |
| `faltou` | Cliente faltou | **Faltou** |

Código: `lib/consultations.ts` (`STATUS_SESSAO_ABERTA`, `statusConsultaBadge`, `isSessaoAberta`).  
Slots públicos e sync ainda tratam `agendado` + `confirmado` como ocupados.

## Clientes (`/clientes`)

- Cadastro principal no **Google Drive** (`clientes.json`)
- Ficha: resumo, atendimentos, observações, pagamentos, anamnese
- **Agendar sessão** → abre Agenda com cliente pré-selecionado
- **Atendimento avulso** e finalização
- Formulário público (`/f/[token]`), link pessoal de agendamento (`?p=token`)
- Sync: formulários, agendamentos online, contatos Google
- **Restaurar da agenda** — na ficha do cliente, importa sessões finalizadas da agenda (Supabase) para o histórico no Drive **sem duplicar** lançamentos no Financeiro
- **Proteção:** não permite excluir cliente com sessão na agenda; backup automático antes de excluir, unificar ou limpar importação
- Anti-duplicação: bloqueia criar atendimento manual na mesma data/hora já existente na ficha
- Paginação na lista (50 por página)

## Catálogo (`/dashboard/catalogo`)

- Serviços (duração, preço) e produtos (estoque opcional)
- Fotos (Supabase Storage — ver [CATALOGO_FOTOS_ARMAZENAMENTO.md](./CATALOGO_FOTOS_ARMAZENAMENTO.md))
- Vitrine pública `/c/[token]`
- Usado na **finalização** de atendimentos (`AtendimentoItensEditor`)

## Comunicação (`/dashboard/comunicacao`)

- Templates WhatsApp com variáveis **bloqueadas** na UI (`MensagemTemplateEditor`)
- Link público de agendamento (`/agendar/{slug}`)
- Disponibilidade (dias/horários) para o agendamento online
- Variáveis: nome do cliente, data, horário, links, profissional, local

## Agendamento público

- **`/agendar/{slug}`** — cliente identifica por telefone ou `?p=token`
- Grava `consultas_agenda` + fila sync Drive; status `confirmado`
- Cria evento no **Google Calendar** do salão na confirmação (rota `confirmar`)
- Horários livres: `lib/publicAgendamentoSlots.ts` (sessões `agendado`/`confirmado` bloqueiam)

## Calendário do cliente

- **`/calendario/adicionar/{token}`** — Google Calendar + `.ics`
- Variável `{{link_calendario}}` nas mensagens

## Financeiro (`/financeiro`)

- Transações (Supabase + espelho Drive); espelho com **backup automático** antes de cada gravação (ver [Backup](#backup-backup))
- Cache client-side com revalidação (`lib/financeiroCache.ts`)
- Filtros por período, profissional, cliente
- Aba **Repasse profissionais** — ver [REGRAS_FINANCEIRO.md](./REGRAS_FINANCEIRO.md)
- PIN de desbloqueio em modo salão

## Backup (`/backup`)

Proteção de dados do tenant no **Google Drive** do salão (jul/2026). A agenda operacional fica no Supabase; fichas e financeiro espelhado ficam no Drive.

### Exportação (já existia)

- Export **CSV** filtrado (agenda + financeiro)
- Download de arquivos principais do Drive (`clientes.json`, `faturamento.json`, etc.)

### Snapshots automáticos no Drive

| Dado | Arquivo | Quando | Retenção |
|------|---------|--------|----------|
| Clientes | `clientes_backup_*.json` | Antes de salvar `clientes.json` (máx. 1 a cada **6 h**) | 48 auto + 24 manuais |
| Financeiro | `faturamento_backup_*.json` | Antes de salvar `faturamento.json` (máx. 1 a cada **6 h**) | 48 auto + 24 manuais |
| Agenda | `agenda_snapshot_YYYY-MM-DD.json` | Após **sync completo** da agenda (1 por dia) | **30 dias** |

Snapshots de clientes/financeiro incluem metadado `_backup` (`reason`, `created_at`, `automatic`). Motivos manuais incluem `delete`, `unificar`, `cleanup-import`, etc.

O snapshot da agenda contém sessões ativas + excluídas nos últimos 30 dias (Supabase `consultas_agenda`).

### Restauração

Na página `/backup`:

- Listar backups de **clientes** e **financeiro** no Drive
- Restaurar um snapshot escolhido (sobrescreve o arquivo principal correspondente)
- Ver status do último snapshot da agenda (`/api/agenda/snapshot-status`)

Na ficha do cliente (`/clientes`):

- **Restaurar da agenda** — sincroniza atendimentos finalizados da agenda para a ficha; repara vínculos consulta↔cliente quando necessário

### Guardas contra perda acidental

- **Excluir cliente:** bloqueado se houver sessão na agenda; snapshot manual antes de apagar
- **Unificar clientes** e **limpeza de importação:** snapshot antes da operação
- **Finalizar sessão** sem ficha no Drive: alerta na UI com orientação para usar “Restaurar da agenda”
- **Repair** (`/api/consultas/repair-cliente-atendimentos`): repara links e sincroniza realizadas por nome/telefone

Código: `lib/clientesDriveBackup.ts`, `lib/faturamentoDriveBackup.ts`, `lib/agendaDriveSnapshot.ts`, `lib/agendaClienteGuard.ts`, `lib/syncClienteAtendimentosFromAgenda.ts`.

## Minha conta (`/dashboard/conta`)

- Plano, status da assinatura, link de pagamento Asaas

## Performance e UX (2026)

Melhorias aplicadas nas fases A–C + polish:

- Cache client: catálogo (`lib/catalogoServicosClient.ts`), lista de clientes (`lib/clientesListCache.ts`, `lib/pacientesOpcoesClient.ts`), financeiro
- Dashboard: sync remoto adiado/debounced; cards Google/lembretes carregam no idle
- Agenda: diff O(n) em consultas; refresh leve ao focar aba
- Busca de clientes: server-side com `limit`; listas grandes truncadas em `SearchableSelect` / `MultiSelect`
- Touch Android: `lib/useDismissableLayer.ts` (dropdowns, finalização, catálogo)
- E2E: `npm run test:e2e` — `e2e/touch-select.spec.ts` (Playwright, Pixel 5)

## APIs públicas

| Rota | Uso |
|------|-----|
| `/f/[token]` | Formulário de cadastro |
| `/c/[token]` | Catálogo vitrine |
| `/agendar/*` | Agendamento online |
| `/api/calendario/adicionar/[token]` | ICS / Google |
| `/api/public/catalogo` | Dados da vitrine |

## Banco (Supabase)

Metadados operacionais: perfis, `consultas_agenda`, agendamento, mensagens, catálogo, financeiro, assinaturas, índice telefone→cliente.  
Dados detalhados do cliente: **Google Drive** do tenant (LGPD).

## Painel admin (equipe Turquesa)

- URL: **`/painel-turque-agenda`** (tenant: `/painel-turque-agenda/tenant/{email}`)
- Não aparece no menu; `ADMIN_EMAILS` na Vercel
- Guia: [INTERNAL_OPS.md](./INTERNAL_OPS.md)

## O que não está ativo

- API WhatsApp Meta (`/api/whatsapp/*`) — apenas wa.me
- Tiers de plano médico (solo/clínica) — só `ilimitado`
