# Contexto Turquesa Agenda (estado em 29/09/2026)

## Mudanças locais sem commit

Correções de desempenho da agenda, clientes e financeiro (menos consultas grandes ao Supabase), feitas numa conversa anterior. Arquivos: `app/api/clientes/route.ts`, `components/AgendaPageClient.tsx`, `components/ClientesCrmDashboardCard.tsx`, `components/ClientesPageClient.tsx`, `lib/agendaTimeLww.ts`, `lib/clientesCrmLastSessao.ts`, `lib/consultasAgenda.ts`, `lib/financeiroList.ts`, `lib/syncConsultasFromGoogleServer.ts`.

- **Não fazer commit nem deploy sem o OK do Pedro.**
- Antes de subir: tirar os logs de depuração `passo()`, rodar `npm run build` e `npm run test:e2e`.
- Pendências opcionais: criar um tenant de demonstração, tirar o servidor local da conta da Marri, revisar outros `.in()` grandes.

Os arquivos não rastreados (guerrilha-cwb, instagram, pitch, meta-reels, amostras) são de outras conversas. Não mexer sem perguntar.

## Regras

- A conta da Marri tem clientes reais (LGPD): em capturas, mascarar tudo e conferir quadro a quadro; nunca gravar nomes reais em disco; só navegação de leitura.
- Não ler `.env.local`.
- Deploy de produção na Vercel só com aprovação.