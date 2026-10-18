# 18/10/2026 — Primeiro uso: CTA WhatsApp sumia após Google

## Logins (17–18/10)

| Conta | Perfil | Uso |
|-------|--------|-----|
| `med.trab7676@gmail.com` | Márcia Cristina Marques, WhatsApp (19) 99620-8436, onboarding ok, seed Corte/Escova/Manicure | Google Drive+Calendar+Contatos conectados; 0 clientes / 0 sessões |
| `izadoraalves68@gmail.com` | Só login (~09:23 BRT) | Sem onboarding_profiles; sem Clarity |

Qualidade: Márcia fraca pro vertical (e-mail `med.trab` = medicina do trabalho; Meta Advantage+). Izadora indefinida.

## Clarity

- Márcia: onboarding enxuto ok → agenda → “Reconectar Google” → `google_connected=google` → saiu ~8 s sem mandar WhatsApp.
- Outro prospect Meta: `login?error=Configuration` + dead clicks em “Abrir no navegador externo” (Instagram in-app).

## Causa

O `AgendaPageGate` bloqueia a agenda até Drive+Calendar. Enquanto isso o `AgendaPageClient` (banner `?primeiro=1`) não monta. O OAuth voltava em `/agenda` sem o flag → CTA “Mandar link no WhatsApp” sumia.

## Correção (este commit)

- `lib/primeiroUsoClient.ts` — flag sessionStorage
- Onboarding: CTA **Liberar Google e abrir agenda**
- Gate: copy “Quase lá” + redirect `/agenda?primeiro=1` na 1ª conexão
- Agenda: restaura banner WhatsApp após OAuth; trata `google_connected=google`
- `InAppBrowserNotice`: iOS prioriza copiar link

## Conferir depois do deploy

1. Conta nova (ou limpar sessão): onboarding → liberar Google → agenda com banner WhatsApp
2. Clarity nos próximos cadastros Meta
3. Se Márcia voltar: deve ver o CTA (flag / primeiro uso)
