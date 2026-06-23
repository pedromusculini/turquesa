# WhatsApp Business (Meta Cloud API)

Turquesa Agenda envia mensagens pelo WhatsApp Business Platform: lembretes **7 dias** e **1 dia** antes da consulta, botões **Confirmar/Cancelar**, formulários e fila em Supabase.

Sem as variáveis abaixo, o app ainda abre links `wa.me` e grava na fila para processamento posterior.

## SQL no Supabase

Execute nesta ordem:

1. [`sql/operacional_schema.sql`](../sql/operacional_schema.sql) — `whatsapp_fila`, formulários
2. [`sql/consultas_whatsapp_schema.sql`](../sql/consultas_whatsapp_schema.sql) — `consultas_agenda`, lembretes, conversas

## Environment variables

Defina em `.env.local` e na Vercel **Production** (ver [ENVIRONMENT.md](./ENVIRONMENT.md)).

| Variable | Required | Description |
|----------|----------|-------------|
| `WHATSAPP_TOKEN` | Yes | Access token (WhatsApp → API Setup) |
| `WHATSAPP_PHONE_NUMBER_ID` | Yes | Phone number ID |
| `WHATSAPP_VERIFY_TOKEN` | Yes | Token escolhido por você para o webhook |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | No | WABA ID |
| `WHATSAPP_API_VERSION` | No | Default: `v21.0` |
| `CRON_SECRET` | Yes (prod) | Bearer para crons (`Authorization: Bearer …`) |
| `WHATSAPP_TEMPLATE_FORMULARIO_LINK` | Yes* | Nome do template aprovado |
| `WHATSAPP_TEMPLATE_LEMBRETE_CONSULTA` | Yes* | Nome do template de lembrete |
| `WHATSAPP_TEMPLATE_FORMULARIO_RECEBIDO` | No | Confirmação pós-formulário |
| `WHATSAPP_TEMPLATE_CONFIRMACAO_PAGAMENTO` | No | Confirmação de pagamento |

\* Sem template aprovado, itens da fila ficam em `status: erro` com mensagem clara.

## Meta setup

1. [Meta for Developers](https://developers.facebook.com/) → app **Business** com produto **WhatsApp**.
2. Copie **Phone number ID** e access token.
3. **WhatsApp → Configuration** → webhook:
   - **Callback URL:** `https://www.turquesaagenda.com.br/api/whatsapp/webhook`
   - **Verify token:** igual a `WHATSAPP_VERIFY_TOKEN`
   - Assine o campo **`messages`** (obrigatório para Confirmar/Cancelar).
4. Crie templates **Utility** em `pt_BR`:

**`lembrete_consulta`** (exemplo):

```
Olá {{1}}, lembrete: consulta em {{2}} às {{3}} — {{4}}. Local: {{5}}
```

Parâmetros: paciente, data, hora, serviço, local.

5. Coloque os nomes exatos em `WHATSAPP_TEMPLATE_*`.
6. Em produção, use número verificado (não só sandbox).

## Fluxo no dia a dia

1. Médico agenda na **Agenda** com WhatsApp do paciente e marca **Enviar lembretes WhatsApp**.
2. Consultas são sincronizadas em `consultas_agenda` (`POST /api/consultas/sync`).
3. Cron **`GET /api/whatsapp/lembrete-agendado`** (11:00 UTC) enfileira lembretes D-7 e D-1 e processa a fila.
4. Cron **`GET /api/whatsapp/process`** (23:00 UTC) processa pendências restantes.
5. Após o template, o sistema envia botões **Confirmar** / **Cancelar**.
6. Resposta do paciente atualiza `consultas_agenda.status` (`confirmado` / `cancelado`).

Status no app: **Perfil → cartão WhatsApp Business** (`GET /api/whatsapp/status`).

## Crons (vercel.json)

| Horário (UTC) | Rota |
|---------------|------|
| 11:00 | `/api/whatsapp/lembrete-agendado` |
| 23:00 | `/api/whatsapp/process` |

Vercel envia `Authorization: Bearer <CRON_SECRET>`.

## Teste local

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" http://localhost:3000/api/whatsapp/lembrete-agendado
curl -H "Authorization: Bearer SEU_CRON_SECRET" http://localhost:3000/api/whatsapp/process
```

Usuário logado também pode `POST` nas mesmas rotas.

## Privacidade (LGPD)

Obtenha consentimento para mensagens WhatsApp. Envie lembretes apenas com telefone válido e opção marcada na agenda.

## Roadmap

Agendamento público (`/agendar/[slug]`) e grade de horários: [WHATSAPP_ROADMAP.md](./WHATSAPP_ROADMAP.md).
