# Checklist manual — Sync da Agenda (E2E)

Conta de teste: `marrissamartins@gmail.com`

1. Login + Google conectado
2. SQL fases 1 e 5 aplicados
3. Mount: grade carrega sem sumir nomes
4. `GET /api/consultas/agenda-view` com `paciente` preenchido
5. Badges sync_health visíveis sem esconder nome do cliente
6. Observações no modal e na lista mobile
7. Sincronizar tudo sem duplicar
8. Editar horário (drag) persiste
9. Editar profissional + data: um evento no Google, um no sistema
10. WhatsApp no modal (3 botões)
11. Conflito LWW + modal
12. Admin sync_health em `/naomexaaquiseucorno/tenant/...`

Ver `docs/AGENDA_SYNC.md` para detalhes técnicos.
