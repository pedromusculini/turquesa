# Contexto Turquesa Agenda (estado em 15/10/2026, tarde)

## Bug da verificação Google (15/10, corrigido e no ar)

- Caso real (perfil teste, Yolanda): sessão de 25/11 com a Marri ligada a um evento do Google criado em 12/08. Em 14/10 esse **mesmo evento** foi para a agenda da Rani em 04/11. O pull do Google não cria sessão nova para evento já ligado: reescreveu a própria sessão (mesmo id) para 04/11 com a Rani.
- O cartão de verificação mostrava o estado antigo ("25/11 · Marri · no Google está em 04/11"). "Cancelar na Turquesa" manda só o id da sessão, então cancelou a sessão que já era a de 04/11, e `cancelarSessaoPelaVerificacao` (`lib/agendaGoogleVerificacao.ts`) mandou a fila apagar o evento ligado: o 04/11 sumiu do Google.
- **Correção no ar desde 15/10** (commit `07756aa`): `lib/agendaGoogleVerificacao.ts`, rota `app/api/agenda/google-verificacao/route.ts`, `components/AgendaGoogleVerificacaoCard.tsx`, `lib/consultasGoogleOutbox.ts` (`discardGoogleOutboxForConsulta`), `lib/consultasAgendaLog.ts`, guarda de cancelada em `pushEventToGoogleCalendar` (`components/AgendaPageClient.tsx`), `docs/AGENDA_SYNC.md`.
  - Novo botão "Usar o horário do Google" (ação `usar_google`): leva a sessão para a data e a profissional do evento, sem escrever no Google.
  - "Cancelar só na Turquesa" nunca apaga no Google: desliga o vínculo e descarta o pendente da fila; se o evento seguir ativo, o pull o importa como sessão própria.
  - Toda ação manda `inicio`/`medico` vistos no cartão; se a sessão mudou, responde 409 e não faz nada.
  - Sessão cancelada não cria nem recria evento pelo navegador.
- Estado atual: sessão de 04/11 da Yolanda cancelada no Turquesa e sem evento ativo no Google. Reabrir só com OK do Pedro.

## Público dos anúncios (13/10)

- O Turquesa é **nacional**: anúncio de vendas mira o Brasil inteiro, nunca raio de cidade. O raio de 10 km em Curitiba é de outro projeto (serviço local).
- Em estudo, sem mexer na campanha: Advantage+ ligado com sugestões (idade, interesses de beleza e um público personalizado com os e-mails @gmail de salões que o robô do `saaslicita` já prospecta, base de dados abertos do CNPJ) e semelhante (lookalike) Brasil a partir dessa lista. "Usuários de Gmail" não existe como interesse na Meta.
- A lista de leads nunca entra neste repositório nem no chat. Exportação em `E:\Documents\dados-turquesa\` (fora do git): `node exportar-leads-meta.mjs` lê o banco do robô só para leitura e gera `meta-saloes-gmail-AAAA-MM-DD.csv` (13/10: 27.575 e-mails @gmail, sem opt-out, devolvidos nem inválidos; nome e sobrenome só de MEI, CPF nunca vai). Público "Salões Gmail CNPJ 13-10" (id 120250122797380143) pronto na Meta em 13/10 com 17,5–20,6 mil pessoas; CSV já apagado.
- **Aplicado em 14/10 às 5h25** (`E:\Documents\dados-turquesa\editar-conjunto-vendas.mjs --aplicar`): "Conjunto para Vendas - ago26" com Advantage+ ligado; controles Brasil + idade mín. 18 + português; sugestões = lista Salões Gmail + 25–55; sem interesses/comportamentos. Otimização (cadastro), orçamento e anúncios iguais. Aprendizado recomeçou: não mexer por ~7 dias (até ~21/10), comparar custo por cadastro com a semana anterior. Os semelhantes "Website using Purchase" da conta falharam na Meta e podem ser apagados.
- Evento otimizado: `CompleteRegistration` (onboarding). Compra não serve: cobra no dia 30 e a atribuição da Meta vai no máximo a 7 dias do clique. A campanha segue otimizando o cadastro até a ativação passar de ~15–25/semana; trocar depois duplicando o conjunto.
- **Eventos novos na CAPI (no ar desde 15/10, SQL aplicado):** `Lead` no 1º login Google (`/api/auth/google-access/status`) e `StartTrial` = ativação (qualquer sessão na agenda, inclusive importada do Google, em até 7 dias do onboarding), enviado pelo cron diário `/api/cron/ativacao-emails` com a hora real da 1ª sessão. O onboarding guarda `_fbp`/`_fbc`/user-agent em `onboarding_profiles` (`sql/meta_atribuicao_columns.sql`, `npm run db:meta-atribuicao`). Perfil teste e `ADMIN_EMAILS` nunca viram conversão. Ordem para subir: SQL primeiro, depois deploy.

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

**No ar desde 15/10 ~10h05** (push até `f9d026b`, domínios promovidos com `npm run deploy:promote:wait`; SQL `db:meta-atribuicao` aplicado antes). Build ok; e2e: 4 ok, 3 falhas antigas (banner de cookies e touch-select, testes de junho desatualizados — corrigir os testes).

1. `b508d69` fila do Instagram a partir de 16/10.
2. `07756aa` verificação Google (bug da Yolanda).
3. `ef714f8` link da ficha sem localhost.
4. `a5aef0a` eventos Meta Lead/StartTrial.
- Ainda sem commit: `docs/ads-preview/onda3v2-*` (prévias de anúncio); não rastreados `.agents/rules`, `.github/instructions` (regras de agente) e `docs/resumos/`.
- As "correções de desempenho" do agente na nuvem não estão em nenhum ramo do GitHub (conferido em 15/10). A busca abrangente já existia no `master` (`lib/clienteSearch.ts`: sem acento/til/pontuação, tolera erro de digitação, telefone por dígitos).
- **Desempenho no ar desde 15/10 à tarde** (`0cb494d`, domínios promovidos; e2e igual ao anterior):
  - Lembretes WhatsApp: `/api/lembretes/pendentes` busca em paralelo; a promoção de bloqueios do Google (`promoteGoogleBloqueiosDeClientes`, no máx. 1x/10 min por conta) roda depois da resposta (`after()`). Cartão abre na hora com o último resultado do dia guardado no aparelho (`lib/lembretesCache.ts`) e não espera mais 1,4 s no painel.
  - Medição Clarity 08–15/10 (antes do deploy): agenda é a pior (LCP mobile ~9,9 s; INP no PC ~1,7 s); CLS 0,6–1,0 em geral; onboarding LCP mobile ~16 s.
  - **Medição real da agenda (15/10, PC, conta teste):** calendário só aparece ~16 s após abrir; ~15 chamadas `/api` em paralelo levando 2–6 s cada (até `/api/legal/consent-status` 2,1 s); `/api/perfil` chamado 2x; travadas de 1–2,3 s no navegador processando respostas. Causas: banco Supabase em **us-west-2 (Oregon)** e funções Vercel em **gru1 (São Paulo)** (~150–200 ms por consulta), e o callback `jwt` do login fazia 3 consultas (1 gravação) em toda chamada autenticada, no middleware e de novo na rota.
  - **No ar desde 15/10 à noite (`fc287c1`, domínios promovidos; build ok, e2e igual):** login, região `pdx1` (conferido: `x-vercel-id` gru1::pdx1), vazamento e agenda leve abaixo. **Medido 15/10 11h35 (PC, conta teste):** calendário em 2,7 s (antes ~16 s); chamadas `/api` em 0,3–0,8 s (antes 2–6 s); `/api/perfil` 1x; ainda 1 travada de 1,4 s no navegador. Conferir Clarity (celular) em alguns dias.
  - **Travada da agenda (15/10, sem commit, build ok):** perfil de CPU mostrou 3,1 s em `parseEventDate` chamada milhões de vezes pelo passo 2 de `dedupeConsultations` (n², 3x na abertura). Agora horários pré-calculados e pares fora de ±1 min descartados (resultado idêntico em 200 rodadas; 600 consultas 176→14 ms); `parseEventDate` guarda timestamp por string (até 5000); `scheduleSyncConsultasToServer`/`listConsultasPendingPush` saem na hora sem rascunho `local-*`; clientes da agenda esperam 5 s de verdade. Para medir, usar o Brave do Cursor na porta 9333 (perfil próprio); a 9222 é do robô do saaslicita.
  - Login: `auth.ts` relê `google_account_access` no máx. a cada 5 min (token `accessCheckedAt` + memória da instância); `touchLastLoginIfVerified` sem leitura extra; `ownerGoogleTokens` guarda o access token na memória da instância até 5 min e só consulta migração de cookies se houver cookie legado. Funções em `pdx1` (Portland, ao lado do banco) via `vercel.json`.
  - **Vazamento de código de servidor para o navegador (15/10, corrigido):** telas importavam funções puras de arquivos que usam banco/cripto, levando ~318 KB de cripto + ~228 KB de Supabase ao celular. Funções puras separadas em `*Format.ts`/arquivos próprios (`clienteFichaFormat`, `medicosPublicosFormat`, `consultaInicioBr`, `agendaTelefone`, `enderecoPerfil`, `primeiroUsoServicos`, `precoPlano`, `anamneseTipos`, `lembretesSettingsFormat`, `resgateSettingsFormat`); os arquivos de servidor reexportam. Agenda, painel, clientes, onboarding, agendamento público, formulário `/f`, login e site sem esses pacotes. Ainda vazam: configurações (via `mensagensWhatsapp`/`mensagemTemplate`), relatório de clientes (`clientesCrmLastSessao`) e painel interno. Regra: componente `'use client'` não importa arquivo que use `supabaseClient` ou `crypto`.
  - **Agenda mais leve ao abrir (15/10):** profissionais e conexão Google usam o último estado salvo no aparelho (passa `userEmail`), então o calendário não espera a rede; lista completa de clientes só busca 5 s depois ou ao abrir o modal de agendamento; `/api/config/agenda` adiado 1,5 s; `/api/perfil/tour` adiado 2,5 s quando há preferência salva no aparelho; botão Modo Salão consulta `/api/financeiro/unlock` 1,5 s depois; perfil saía 2x porque `loadMedicosOptions` fazia o próprio `fetch('/api/perfil')`; agora usa `fetchPerfilRaw` (pedido em andamento no `globalThis`). Preview da Vercel não tem as variáveis de banco/login/Google (só Clarity/GA/health).
  - Clientes: tela abre vazia; carrega só ao buscar ou em "Ver todas as clientes" (aviso de duplicatas só com a lista completa; importação do formulário abre a lista). Busca mostra prévia na hora pelo cache do aparelho (`clientesListCache`, pré-carregado em segundo plano) e o servidor confirma. `clienteBuscaHaystack` é o mesmo no servidor e no aparelho.
- **Não fazer commit nem deploy sem o OK do Pedro.** Antes de subir: `npm run build` e `npm run test:e2e`.
- Pendências opcionais: criar um tenant de demonstração, tirar o servidor local da conta da Marri.

- **Link da ficha/anamnese no Google (14/10):** servidor local rodando com a conta da Marri gravou `http://localhost:3000/r/...` no campo "local" de 9 eventos futuros (inclusive a Leticia de 14/10, 17h, com a Rani). Corrigidos direto no Google com `scripts/_fix-ficha-localhost.mjs <ownerEmail> [--aplicar]` (sem `--aplicar` só lista). Prevenção sem commit: `lib/professionalCalendarAnamnese.ts` e `createShortRedirectUrl(url, baseUrl)` em `lib/shortLink.ts` passam a usar sempre `CANONICAL_APP_URL`. Outros links (WhatsApp, formulário) ainda usam `NEXTAUTH_URL`: evitar rodar o servidor local com a conta da Marri.

Guerrilha-cwb, roteiros do Instagram, pitch e meta-reels estão no stash de 15/09 ("moved local changes to cloud agent") e no ramo `cursor/cloud-agent-1789467503056-q758u`, fora da pasta. Não mexer sem perguntar.

## Regras

- A conta da Marri tem clientes reais (LGPD): em capturas, mascarar tudo e conferir quadro a quadro; nunca gravar nomes reais em disco; só navegação de leitura.
- Não ler `.env.local`.
- Deploy de produção na Vercel só com aprovação.