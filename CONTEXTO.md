# Contexto Turquesa Agenda (estado em 12/10/2026)

## Aquisição (12/10)

- 36 logins Google, 30 onboardings completos. De 10 a 12/10: Ronne e Sonia/StudioBellaLash (Meta, onda3v2), ambas em trial até 10 e 11/11; Anny (terapeuta, veio pelo Instagram) logou mas abandonou o onboarding sem aceitar os termos.
- Nenhuma das novas cadastrou clientes ainda; Sonia criou 2 sessões e voltou em 12/10.
- Público estreito no Meta (sem Advantage+) desde 10/10, em aprendizado: não mexer até ~14/10. Meta põe quase toda a verba no onda3v2; o Onda8 (Google) quase não entrega.
- A conta de anúncios também paga a campanha da Gabi (pasta `E:\Documents\Gabi`). Saldo de R$ 1.700,48 em 12/10; limite de gasto da conta bate em ~R$ 1.494 a mais.
- Clarity e Pixel só rodam com o banner de cookies aceito: sessões no Chrome após sair do Instagram costumam não aparecer.
- Clarity: dashboard com CLS 1,2–1,3 (layout pulando) e página pública `/s/...` com LCP de 5 s.
- 12 contas dos últimos 14 dias sem nenhuma sessão e com 0 clientes: o gargalo é depois do cadastro.

## Melhorias de ativação (12/10, local, build ok, sem commit nem deploy)

- Onboarding: novos serviços (Cílios, Unhas em gel, Depilação, Limpeza de pele, Massagem) + campo "Outro"; nada vem pré-marcado (`lib/primeiroUsoSalao.ts`, rota `primeiro-uso`).
- Checklist "Primeiros passos" com 4 passos; o 1º, "Traga suas clientes", abre `/clientes?google=1` com a busca do Google Contatos ligada. `AtivacaoResumo` agora conta `clientes`.
- Painel não pula: checklist e resumo do trial abrem com o último estado salvo no aparelho (`lib/ativacaoClient.ts`).
- Admin: lista "Novas sem sessão" com botão WhatsApp (wa.me) e mensagem pronta (`lib/internalMetrics.ts`, `InternalOpsClient`).
- `lib/instagramAgenda.ts` modificado é de outra conversa — não entra neste commit.

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