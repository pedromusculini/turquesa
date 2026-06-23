# Auditoria rebrand MedSup → Turquesa Agenda

**Data:** 2026-06-03  
**Fonte visual única:** `lib/visual/brand.ts` (alterar aqui primeiro; espelhar `app/globals.css` `:root`)

## Corrigido nesta rodada

| Área | Arquivo(s) |
|------|------------|
| Login (2ª página pós-landing) | `app/login/page.tsx` — plano único, sem Médico Solo/Clínica |
| Onboarding | `app/onboarding/page.tsx` — copy salão, plano `ilimitado`, cores marca |
| Escolha de plano legado | `app/auth/choose-plan/page.tsx` — redirect para `/login?plan=ilimitado` |
| Planos públicos | `app/planos/page.tsx` — import `BRAND` |
| Landing / header | `components/LandingPageContent.tsx`, `components/Header.tsx` |
| Legal (alta visibilidade) | `app/termos/page.tsx`, `app/privacidade/page.tsx` |
| Tokens globais | `app/globals.css`, `lib/constants.ts` → reexport de `brand.ts` |
| API onboarding | `app/api/onboarding/save/route.ts` — validação plano ilimitado |

---

## P0 — Marca / copy MedSup explícito

| Arquivo | Motivo |
|---------|--------|
| `middleware.ts` | Redirect `turquesaagenda.com.br` (manter até desligar domínio legado ou apontar para turquesa) |
| `lib/internalProduct.ts` | IDs / fallbacks produto |
| `lib/jwt.ts`, `lib/cookieConsent.ts` | Strings/chaves legado |
| `README.md`, `.env.example`, `vercel.json`, `package-lock.json` | Docs/env nomes MedSup |
| `components/ChromeExtensionNotice.tsx` | Copy extensão |
| `components/BackupPageClient.tsx` | Referências MedSup em UI backup |
| `app/auth/verificar-email/page.tsx` | Cores verde MedSup + copy |
| `app/f/[token]/page.tsx` | Formulário público — paciente/consulta |
| `app/api/auth/register/route.ts` | Registro legado |
| `app/api/google-drive/route.ts` | Mensagens / paths médicos |

## P1 — Cores verde MedSup (`#90EE90`, `#228B22`, `#eafde7`)

Substituir por `BRAND.colors` ou variáveis `--brand-*`:

- `components/SignInForm.tsx`
- `app/dashboard/perfil/page.tsx` (copy médico/clínica + cores)
- `app/dashboard/page.tsx`, `app/dashboard/configuracoes/page.tsx`, `app/dashboard/comunicacao/page.tsx`
- `app/agenda/page.tsx`, `components/AgendaPageClient.tsx`, `components/AgendaConsultaModal.tsx`
- `components/AgendarPublicoClient.tsx`, `app/agendar/[slug]/page.tsx`
- `components/AssinaturaChangeCard.tsx`, `components/ContaPageClient.tsx`
- `components/BackupPageClient.tsx`, `components/ClientesPageClient.tsx`
- `components/ComunicacaoClient.tsx`, `components/ComunicacaoLinkCard.tsx`
- `components/CookieConsentBanner.tsx`, `components/DashboardAgendaHoje.tsx`
- `components/FinanceiroPageClient.tsx`, `components/FinalizarConsultaModal.tsx`, `components/FinalizarAtendimentoModal.tsx`
- `components/GoogleIntegracaoCard.tsx`, `components/HorariosAgendaEditor.tsx`
- `components/LembretesWhatsAppCard.tsx`, `components/LegalDocumentLayout.tsx`
- `components/MedicoPublicoPicker.tsx`, `components/MensagemTemplateEditor.tsx`
- `components/PacienteSearchField.tsx`, `components/SearchableSelect.tsx`
- `app/calendario/adicionar/[token]/page.tsx`, `app/page.tsx`
- `public/favicon.svg`, `public/apple-icon.svg`, `app/icon.svg`, `app/apple-icon.svg`

## P2 — Terminologia médica (UI/copy; manter nomes SQL/API até migração)

### Paciente → Cliente (componentes e labels)

- `components/PacienteSearchField.tsx`
- `lib/pacienteOpcoesUi.ts`, `lib/resolvePacienteCliente.ts`, `lib/ensurePacienteClienteClient.ts`
- `app/api/clientes/resolve-paciente/route.ts`, `app/api/clientes/pacientes-opcoes/route.ts`
- Demais em `app/api/clientes/*`, `app/f/[token]/page.tsx`, modais de agenda/finalizar

### Consulta → Sessão / atendimento

- `lib/consultations.ts`, `lib/consultasAgenda.ts`, `lib/syncConsultasClient.ts`
- `lib/registrarConsultaLembrete.ts`, `app/api/consultas/*`, `app/api/lembretes/*`
- `components/AgendaConsultaModal.tsx`, `components/FinalizarConsultaModal.tsx`
- `components/DashboardAgendaHoje.tsx`, `lib/constants.ts` (`ATENDIMENTO_LABEL`, categorias `consulta`)

### Médico / clínica (perfil e equipe)

- `app/dashboard/perfil/page.tsx`, `app/api/perfil/medicos/route.ts`
- `components/MedicoSelect.tsx`, `components/MedicoPublicoPicker.tsx`, `lib/medicosPublicos.ts`, `lib/loadMedicosOptions.ts`
- `lib/applyPlanChange.ts`, `lib/subscriptionPlans.ts` (legado `medico-pix` / `clinica-*` — OK em contas antigas)

## P3 — Código interno / eventos (baixa visibilidade)

| Arquivo | Nota |
|---------|------|
| `lib/consultations.ts` | Evento `medsupapp-consultations-updated` |
| `components/AgendaPageClient.tsx` | Listener evento legado |
| `lib/asaasBillingPolicy.ts`, `lib/calendarInvite.ts`, `lib/clientesDrive.ts` | Comentários/strings MedSup |
| `lib/csv-export.ts`, `lib/googleDrive.ts`, `lib/googleContacts.ts`, `lib/mensagemTemplate.ts` | Export/integrações |
| `lib/types.ts` | Tipos `medico`/`clinica`/`paciente` |

## P4 — Documentação

- `docs/PALETA_CORES.md` — referência opcional MedSup
- `docs/COMMIT_AND_DEPLOY.md`, `docs/FUNCIONALIDADES.md` — revisar menções template

---

## Próximos passos sugeridos

1. **Prompt C:** onboarding API — campos `profissao`/`servicos` (hoje ainda `crm`/`specialty` no payload).
2. **Prompt D:** módulos Agenda, Clientes, Financeiro, Comunicação (P2 em lote).
3. Migrar componentes P1 para `import { BRAND } from '@/lib/visual/brand'`.
4. Atualizar ícones SVG (`public/favicon.svg`) com paleta petróleo/turquesa.
5. `middleware.ts`: redirect medsup → turquesaagenda.com.br quando domínio legado for desligado.

---

## Comandos úteis de auditoria

```bash
# Marca explícita
grep -ri "medsup\|MedSup\|Médico Solo\|medico-pix" --include="*.{ts,tsx,md}"

# Verde legado
grep -r "#90EE90\|#228B22\|#eafde7" --include="*.{tsx,css}"

# Terminologia médica em UI
grep -ri "paciente\|consulta\|prontuário\|CRM" app components --include="*.tsx"
```
