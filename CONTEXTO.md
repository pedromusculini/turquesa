# Contexto Turquesa Agenda (estado em 15/10/2026, 10h)

## Bug achado em 15/10 (só diagnóstico, nada alterado)

- Caso real (perfil teste, Yolanda): sessão de 25/11 com a Marri ligada a um evento do Google criado em 12/08. Em 14/10 esse **mesmo evento** foi para a agenda da Rani em 04/11. O pull do Google não cria sessão nova para evento já ligado: reescreveu a própria sessão (mesmo id) para 04/11 com a Rani.
- O cartão de verificação mostrava o estado antigo ("25/11 · Marri · no Google está em 04/11"). "Cancelar na Turquesa" manda só o id da sessão, então cancelou a sessão que já era a de 04/11, e `cancelarSessaoPelaVerificacao` (`lib/agendaGoogleVerificacao.ts`) mandou a fila apagar o evento ligado: o 04/11 sumiu do Google.
- **Correção feita em 15/10, sem commit nem deploy** (aguarda OK do Pedro): `lib/agendaGoogleVerificacao.ts`, rota `app/api/agenda/google-verificacao/route.ts`, `components/AgendaGoogleVerificacaoCard.tsx`, `lib/consultasGoogleOutbox.ts` (`discardGoogleOutboxForConsulta`), `lib/consultasAgendaLog.ts`, guarda de cancelada em `pushEventToGoogleCalendar` (`components/AgendaPageClient.tsx`), `docs/AGENDA_SYNC.md`.
  - Novo botão "Usar o horário do Google" (ação `usar_google`): leva a sessão para a data e a profissional do evento, sem escrever no Google.
  - "Cancelar só na Turquesa" nunca apaga no Google: desliga o vínculo e descarta o pendente da fila; se o evento seguir ativo, o pull o importa como sessão própria.
  - Toda ação manda `inicio`/`medico` vistos no cartão; se a sessão mudou, responde 409 e não faz nada.
  - Sessão cancelada não cria nem recria evento pelo navegador.
- Estado atual: sessão de 04/11 da Yolanda cancelada no Turquesa e sem evento ativo no Google. Reabrir só com OK do Pedro. Até o deploy, não usar os botões do cartão em itens de "horário diferente".

## Público dos anúncios (13/10)

- O Turquesa é **nacional**: anúncio de vendas mira o Brasil inteiro, nunca raio de cidade. O raio de 10 km em Curitiba é de outro projeto (serviço local).
- Em estudo, sem mexer na campanha: Advantage+ ligado com sugestões (idade, interesses de beleza e um público personalizado com os e-mails @gmail de salões que o robô do `saaslicita` já prospecta, base de dados abertos do CNPJ) e semelhante (lookalike) Brasil a partir dessa lista. "Usuários de Gmail" não existe como interesse na Meta.
- A lista de leads nunca entra neste repositório nem no chat. Exportação em `E:\Documents\dados-turquesa\` (fora do git): `node exportar-leads-meta.mjs` lê o banco do robô só para leitura e gera `meta-saloes-gmail-AAAA-MM-DD.csv` (13/10: 27.575 e-mails @gmail, sem opt-out, devolvidos nem inválidos; nome e sobrenome só de MEI, CPF nunca vai). Público "Salões Gmail CNPJ 13-10" (id 120250122797380143) pronto na Meta em 13/10 com 17,5–20,6 mil pessoas; CSV já apagado.
- **Aplicado em 14/10 às 5h25** (`E:\Documents\dados-turquesa\editar-conjunto-vendas.mjs --aplicar`): "Conjunto para Vendas - ago26" com Advantage+ ligado; controles Brasil + idade mín. 18 + português; sugestões = lista Salões Gmail + 25–55; sem interesses/comportamentos. Otimização (cadastro), orçamento e anúncios iguais. Aprendizado recomeçou: não mexer por ~7 dias (até ~21/10), comparar custo por cadastro com a semana anterior. Os semelhantes "Website using Purchase" da conta falharam na Meta e podem ser apagados.
- Evento otimizado: `CompleteRegistration` (onboarding). Compra não serve: cobra no dia 30 e a atribuição da Meta vai no máximo a 7 dias do clique. A campanha segue otimizando o cadastro até a ativação passar de ~15–25/semana; trocar depois duplicando o conjunto.
- **Eventos novos na CAPI (13/10; commit a5aef0a em 15/10, sem push/deploy, SQL não aplicado):** `Lead` no 1º login Google (`/api/auth/google-access/status`) e `StartTrial` = ativação (qualquer sessão na agenda, inclusive importada do Google, em até 7 dias do onboarding), enviado pelo cron diário `/api/cron/ativacao-emails` com a hora real da 1ª sessão. O onboarding guarda `_fbp`/`_fbc`/user-agent em `onboarding_profiles` (`sql/meta_atribuicao_columns.sql`, `npm run db:meta-atribuicao`). Perfil teste e `ADMIN_EMAILS` nunca viram conversão. Ordem para subir: SQL primeiro, depois deploy.

## Aquisição (12/10)

- 36 logins Google, 30 onboardings completos. De 10 a 12/10: Ronne e Sonia/StudioBellaLash (Meta, onda3v2), ambas em trial até 10 e 11/11; Anny (terapeuta, veio pelo Instagram) logou mas abandonou o onboarding sem aceitar os termos.
- Nenhuma das novas cadastrou clientes ainda; Sonia criou 2 sessões e voltou em 12/10.
- De 10 a 14/10 o conjunto de vendas rodou com público estreito (sem Advantage+); trocado em 14/10 (ver "Público dos anúncios"). Meta põe quase toda a verba no onda3v2; o Onda8 (Google) quase não entrega.
- A conta de anúncios também paga a campanha da Gabi (pasta `E:\Documents\Gabi`). Saldo de R$ 1.700,48 em 12/10; limite de gasto da conta bate em ~R$ 1.494 a mais.
- Clarity e Pixel só rodam com o banner de cookies aceito: sessões no Chrome após sair do Instagram costumam não aparecer.
- Clarity: dashboard com CLS 1,2–1,3 (layout pulando) e página pública `/s/...` com LCP de 5 s.
- 12 contas dos últimos 14 dias sem nenhuma sessão e com 0 clientes: o gargalo é depois do cadastro.

## Melhorias de ativação (12/10, no ar — commit 8079361)

Deploy: o 1º build falhou na Vercel por "Git information retrieval failed" (instabilidade, não código); resolvido com `npx vercel redeploy <url> --target production` + `npm run deploy:promote`. Conferir no Clarity em alguns dias se o CLS do dashboard caiu.


- Onboarding: novos serviços (Cílios, Unhas em gel, Depilação, Limpeza de pele, Massagem) + campo "Outro"; nada vem pré-marcado (`lib/primeiroUsoSalao.ts`, rota `primeiro-uso`).
- Checklist "Primeiros passos" com 4 passos; o 1º, "Traga suas clientes", abre `/clientes?google=1` com a busca do Google Contatos ligada. `AtivacaoResumo` agora conta `clientes`.
- Painel não pula: checklist e resumo do trial abrem com o último estado salvo no aparelho (`lib/ativacaoClient.ts`).
- Admin: lista "Novas sem sessão" com botão WhatsApp (wa.me) e mensagem pronta (`lib/internalMetrics.ts`, `InternalOpsClient`).
## Mudanças locais sem commit

**Commits locais de 15/10, sem push nem deploy** (build ok; e2e: 4 ok, 3 falhas antigas em banner de cookies e touch-select, testes de junho desatualizados):

1. `b508d69` fila do Instagram a partir de 16/10 — sem deploy, o cron não publica nada a partir de 16/10.
2. `07756aa` verificação Google (bug da Yolanda).
3. `ef714f8` link da ficha sem localhost.
4. `a5aef0a` eventos Meta Lead/StartTrial — rodar `npm run db:meta-atribuicao` **antes** do deploy (o SQL fica em `sql/`, ignorado pelo git).
- Ainda sem commit: `docs/ads-preview/onda3v2-*` (prévias de anúncio); não rastreados `.agents/rules`, `.github/instructions` (regras de agente) e `docs/resumos/`.
- As "correções de desempenho" (com logs `passo()`) anotadas antes **não existem nesta pasta**: arquivos iguais ao último commit, sem stash nem outro ramo com elas. Dadas como perdidas, salvo se estiverem em outro computador ou agente na nuvem.
- **Não fazer commit nem deploy sem o OK do Pedro.** Antes de subir: `npm run build` e `npm run test:e2e`.
- Pendências opcionais: criar um tenant de demonstração, tirar o servidor local da conta da Marri.

- **Link da ficha/anamnese no Google (14/10):** servidor local rodando com a conta da Marri gravou `http://localhost:3000/r/...` no campo "local" de 9 eventos futuros (inclusive a Leticia de 14/10, 17h, com a Rani). Corrigidos direto no Google com `scripts/_fix-ficha-localhost.mjs <ownerEmail> [--aplicar]` (sem `--aplicar` só lista). Prevenção sem commit: `lib/professionalCalendarAnamnese.ts` e `createShortRedirectUrl(url, baseUrl)` em `lib/shortLink.ts` passam a usar sempre `CANONICAL_APP_URL`. Outros links (WhatsApp, formulário) ainda usam `NEXTAUTH_URL`: evitar rodar o servidor local com a conta da Marri.

Guerrilha-cwb, roteiros do Instagram, pitch e meta-reels estão no stash de 15/09 ("moved local changes to cloud agent") e no ramo `cursor/cloud-agent-1789467503056-q758u`, fora da pasta. Não mexer sem perguntar.

## Regras

- A conta da Marri tem clientes reais (LGPD): em capturas, mascarar tudo e conferir quadro a quadro; nunca gravar nomes reais em disco; só navegação de leitura.
- Não ler `.env.local`.
- Deploy de produção na Vercel só com aprovação.