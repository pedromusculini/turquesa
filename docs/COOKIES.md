# Cookies e armazenamento local

Inventário técnico alinhado a `/privacidade#cookies`.

Versão do aviso: `COOKIE_CONSENT_VERSION` em `lib/cookieConsent.ts` — incrementar ao mudar uso de cookies ou texto material.

## Cookies HTTP (servidor)

| Nome | Tipo | Finalidade | httpOnly | secure (prod) | sameSite |
|------|------|------------|----------|---------------|----------|
| `authjs.*` / NextAuth session | Essencial | Sessão login Google | Sim | Sim | lax |
| `google_calendar_token` | Essencial | API Calendar (se autorizado) | Sim | Sim | lax |
| `google_drive_token` | Essencial | API Drive | Sim | Sim | lax |
| `google_contacts_token` | Essencial | API Contatos | Sim | Sim | lax |
| `google_*_token_refresh` | Essencial | Refresh OAuth incremental | Sim | Sim | lax |
| `prontuario_unlock` | Essencial | Desbloqueio ficha (PIN) | Sim | Sim | lax |
| `_fbp`, `_fbc` | Marketing | Meta Pixel (após consentimento) | Não | Sim | lax |

Definição cookies Google: `app/api/auth/google-callback/route.ts`, `lib/googleIncrementalOAuth.ts`.

## Scripts de terceiros (marketing)

| Ferramenta | Finalidade | Consentimento |
|------------|------------|---------------|
| Meta Pixel (`fbevents.js`) | Métricas de anúncios Facebook/Instagram | Banner “Entendi e continuar” |

Componente: `components/MetaPixel.tsx` — só inicializa após `saveCookieConsent()`.

## localStorage (navegador)

| Chave | Finalidade | Consentimento |
|-------|------------|---------------|
| `turquesa-agenda-cookie-consent` | Ciência do aviso de cookies | Banner “Entendi” |
| `turquesa-tour-prefs:{email}` | Progresso tour guiado | Operacional / UX |
| `turquesa-agenda-consultations` | Cache local sessões (legado/sync) | Essencial operação |
| `turquesa-agenda-financeiro:*` | Cache filtros financeiro | Essencial operação |
| `turquesa-agenda-clientes-list:*` | Cache lista de clientes | Essencial operação |
| `turquesa-agenda-perfil:*` | Cache perfil | Essencial operação |

## O que não usamos

- Google Analytics, Hotjar
- API oficial WhatsApp/Meta (comunicação via links wa.me)

## Banner

- Componente: `components/CookieConsentBanner.tsx`
- Meta Pixel carrega somente após aceite
- Safe area iOS: `env(safe-area-inset-bottom)`

## Manutenção

Ao adicionar novo cookie ou storage:

1. Atualizar esta página e `app/privacidade/page.tsx` § cookies
2. Incrementar `COOKIE_CONSENT_VERSION`
3. Usuários verão o banner novamente

## Auditoria rápida (DevTools)

Application → Cookies + Local Storage em `www.turquesaagenda.com.br` após login e após autorizar Google Calendar.
