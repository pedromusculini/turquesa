# Segurança e LGPD — Turquesa Agenda

## Ações implementadas no código

- **RLS Supabase:** políticas abertas removidas (`sql/security_hardening.sql`). Acesso direto com `anon` key bloqueado; APIs usam `SUPABASE_SERVICE_ROLE_KEY` no servidor.
- **Financeiro:** coluna `owner_email` + APIs filtram por conta autenticada.
- **Tokens Google:** não expostos em `useSession` nem em `GET /api/auth/tokens`.
- **OTP:** código de 6 dígitos + rate limit em envio/verificação.
- **Formulário:** respostas removidas do Supabase após sync para o Drive.
- **Legal:** `/privacidade`, `/termos`, consentimento no login, verificação de e-mail, onboarding e formulário público; reaceite automático quando versões legais mudam (`LegalReacceptModal`).
- **Cookies:** banner `CookieConsentBanner` (essenciais + `localStorage` de preferência); seção `#cookies` na política (versão `2026-06-23`); sem cookies de marketing.
- **Agendamento público:** API `identificar` retorna apenas `nome_parcial` (nome completo resolvido no servidor na confirmação).
- **Conta:** seção em `/dashboard/conta` com exportação CSV e canal `privacidade@turquesaagenda.com.br`.

## Papéis LGPD (resumo)

| Papel | Quem | Dados |
|-------|------|-------|
| Controlador | Salão / profissional | Fichas de clientes no Google Drive |
| Operador | Turquesa Agenda | Metadados operacionais no Supabase, autenticação, cobrança |
| Titular | Cliente final | Dados na ficha e no agendamento |

Fichas completas permanecem no Drive do profissional (`drive.file`). O app mantém índices (telefone, agenda, financeiro) para operação.

## O que você deve fazer no Supabase / Vercel

1. Executar `sql/security_hardening.sql` no SQL Editor (idempotente).
2. Confirmar `SUPABASE_SERVICE_ROLE_KEY` na Vercel (chave **service_role**, não anon).
3. Revisar políticas antigas duplicadas no painel Supabase se o projeto já existia.

## Pendências recomendadas (não automatizadas)

- Parecer jurídico e ROPA formal (template em `docs/ROPA_TEMPLATE.md`).
- DPAs com Google, Supabase, Resend, Vercel, Asaas.
- Pentest antes de escala comercial agressiva.
- Rate limit distribuído (ex. Upstash) se brute force persistir entre instâncias.

## Documentos relacionados

- `docs/COOKIES.md` — inventário técnico de cookies e localStorage
- `docs/SECURITY.md` — checklist de release
- `app/privacidade/page.tsx` — política pública
- `app/termos/page.tsx` — termos de uso
