# WhatsApp — fase futura (agendamento self-service)

Implementado no MVP atual:

- Lembretes automáticos **7 dias** e **1 dia** antes (`/api/whatsapp/lembrete-agendado` + cron).
- Confirmação **Confirmar / Cancelar** via botões interativos e webhook inbound.
- Sincronização de consultas em `consultas_agenda` ao usar a agenda.

## Próxima fase (não implementada)

1. **Config de disponibilidade** no perfil (dias/horários, duração do slot, médicos).
2. **Página pública** `/agendar/[slug]` para o paciente escolher horário e profissional.
3. **WhatsApp** enviando link da página em vez de listar muitos horários no chat.
4. Motor de conflitos com Google Calendar FreeBusy ou grade fixa.

Ver também [WHATSAPP_BUSINESS_SETUP.md](./WHATSAPP_BUSINESS_SETUP.md).
