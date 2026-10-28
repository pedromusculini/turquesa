# Contexto Turquesa Agenda (estado em 27/10/2026)

## Onboarding encurtado (27/10, commit local `393d9d5`, NO AR por deploy direto `turquesa-rob67wvhy` em 27/10 22:1x, sem push)

- **Testado em produção (27/10, conta de teste apagada e recriada do zero no banco):** Enter envia; formulário inteiro cabe na primeira tela; foi direto para `/agenda?primeiro=1` sem tela "Pronto" e sem segunda ida ao Google (`agenda_direta`). Etapas gravadas no servidor em ~1,7 s do cadastro à agenda; do Enter ao banner da agenda ≈ 5 s (antes: ~8 s só até a tela "Pronto", mais a ida ao Google e a agenda). Funil `sql/funil_onboarding.sql` roda sem erro.
- Deploy direto levou também as correções de segurança não commitadas (working tree); domínios promovidos com `deploy:promote:wait`. Pendente: Vercel ainda não atualizou o Node das funções (health 503).
- Conta de teste `pedromusculinitester@gmail.com`: linhas apagadas do banco (consultas, catálogo, horários, links, assinatura, equipe, códigos, tokens Google, perfil, acesso); mantido `internal_audit_log` (21 linhas, trilha de auditoria). O Google segue com o acesso concedido, então o teste não reproduz a tela de consentimento de conta nova.

- Fluxo novo: login → formulário (nome + WhatsApp + aceite, `<form>` real: Enter envia) → preparo → Google (ou agenda direta se já liberado) → agenda. Saiu a tela "Pronto" e o clique extra; Google abre sozinho ao fim do preparo.
- Tela de preparo avisa para deixar TODAS as caixas do Google marcadas (hipótese: caixa desmarcada deixa o Google "não saudável" e prende na tela de bloqueio). Gate da agenda com o mesmo aviso e sem rótulo em caixa alta.
- Chamada `/api/presenca/config` roda junto com o preparo; espera de confirmação do cadastro a cada 200 ms (antes 350). Cabeçalho compacto, "Passo 1 de 2 / 2 de 2", preço numa linha. Erro técnico do Supabase trocado por texto amigável.
- Etapas medidas agora: `cadastro_salvo`, `preparo_ok`, `google_redirecionado`, `agenda_direta`, `gate_google_visto`, `agenda_primeiro_uso`, `cta_*`.
- Não feito: sessão de exemplo / "criar primeira sessão" na agenda vazia; escopos do Google em duas fases; lembretes 24h/72h; checkbox de aceite mantida (decisão jurídica do Pedro). `tsc` e `next build` ok; e2e rodado na porta 3100.

## Medição do onboarding ANTIGO em produção (27/10, conta de teste, sem enviar o formulário)

- Login Google já pede todos os escopos (Drive, Calendar, Contatos) no próprio login; para a conta de teste o Google só mostrou "Continuar" (já tinha acesso). Capturas em `.playwright-mcp\`.
- Desktop 1920x951, primeira abertura: TTFB 2,3 s, DOM pronto 6,6 s, `/api/onboarding/status` 3,1 s. Recarregando: DOM pronto 3,3 s (a página ainda é lenta para um formulário de 2 campos).
- Celular 390x844: o botão "Ver minha agenda" fica em y≈1025 (viewport 844): fora da primeira tela; cabeçalho grande empurra o formulário; o aviso de cookies fixo cobre parte do rodapé. Nome do salão vem preenchido com o nome pessoal do Google ("Pedro Henrique").

- **Fluxo antigo completo com dados fictícios (conta de teste, salão "Teste Medicao", WhatsApp fictício; salão real criado nessa conta):** clique em "Ver minha agenda" → tela "Pronto" levou ~8 s, com 5 chamadas em fila: salvar 3,1 s, confirmar 1,1 s, presença 1,0 s, profissional 1,7 s, preparo 1,1 s. Depois, "Liberar Google" levou de novo ao seletor de contas do Google, mesmo já logada (o login já guarda os tokens em `auth.ts`, então essa segunda viagem tende a ser redundante). Agenda aberta com o banner de primeiro uso; grade aparecia na semana de 16/08, não na atual (a conferir).
- Maiores chamadas da agenda no primeiro acesso: `/api/agenda/google-verificacao` 2,1 s, `/api/clientes/pacientes-opcoes` 1,3 s, `/api/auth/google-connections` 0,8 s.

## Diagnóstico do onboarding (27/10, só leitura)

- Contas novas de 01/09 a 27/10 (sem a conta teste): 35. Cadastro completo: 27 (77%). Chegaram a criar sessão na agenda: 7 (20%). Todas as 7 vieram antes do onboarding enxuto de 16/10.
- Depois de 16/10 entraram só 3 contas, nenhuma com sessão: amostra pequena demais para concluir se o fluxo enxuto melhorou ou não.
- Perda principal: ~20 contas fecham o cadastro e nunca criam a primeira sessão (depois do Google e antes da agenda).
- Clarity 13–27/10 (mobile): saídas mais comuns em `/agenda` (50) e `/dashboard` (36). Cliques mortos na agenda e no dashboard (12 cada). Poucos acessos, então são indícios, não prova.
- **Medição por etapa (27/10, código pronto, sem commit; SQL aplicado em 27/10, tabela com RLS):** tabela `onboarding_etapas` (`sql/onboarding_etapas_schema.sql`, `npm run db:onboarding-etapas`), rota `POST /api/onboarding/etapa`, helper `lib/onboardingEtapaClient.ts` e `lib/onboardingEtapas.ts`. Etapas: `pronto_visto`, `google_clicado`, `abrir_agenda_clicado` (onboarding), `gate_google_visto` (gate), `agenda_primeiro_uso`, `cta_whatsapp`, `cta_testar`, `cta_fechar` (agenda). Funil por semana: `sql/funil_onboarding.sql`. Grava no servidor (não depende do banner de cookies); sem a tabela a rota ignora o erro. `tsc --noEmit` e `next build` ok (27/10). e2e (servidor próprio na porta 3100, porque a 3000 é do painel do saaslicita): 4 ok, 2 pulados, 3 falhas nos testes de banner de cookies e touch-select, as mesmas "falhas antigas" já anotadas; não comparei com o estado sem a medição. Ordem para subir: SQL primeiro, depois deploy.
- Também sugerido: contatar à mão as contas paradas pela lista "Novas sem sessão" do admin. Skills de teste em `E:\Documents\teste-skills`.

## Rastreio de agendamentos (26/10)

- Tabela `consultas_agenda_log` registra criação, edição, exclusão e ações do Google. Edições anteriores ao rastreio não têm histórico: não adianta procurar no log.
- Caso Edna Regina (perfil teste, 26/10): edição de 6/11 para hoje 15h foi feita antes do rastreio; sem causa confirmada. Sincronização geral atualiza `updated_at` de todas as sessões, e edição de horário em menos de 5 min depois é descartada (`lib/consultasAgenda.ts:475`). Se repetir, conferir o log.

## Ferramenta de vídeo (registro 27/10)

- Geração de vídeo usada até agora: Google Flow no navegador (`https://labs.google/fx/tools/flow`), modelo Omni Flash ou Veo, 9:16. Não é fal.ai, que não estava sendo usado por falta de verba.
- Os prompts ficam em `E:\Documents\agent drift\projects\prompt-*-flow-*.md`. Ex.: `prompt-b01a-flow-barbearia.md`.
- Clipes gerados vão para `incoming/`, e a montagem (texto, voz, legenda) é feita depois.
- Edição (27/10): `marketing\motion\tati-flow\editar_clipes.py` põe texto na tela e o aviso "Conteúdo feito com IA" nos 4 clipes prontos (t12-1, t12-2, t12-3, t14-1). Saída em `marketing\motion\tati-flow\editados\` (720x1280, 8s). Narração da Tati (Gemini TTS, roteiros em `marketing\motion\tati-flow\narracao\`, 5–7s cada) substituiu o áudio gerado pelo Flow. Os WAV ficam em `agent drift\incoming\tati-*.wav`.
- Reels agendados (27/10): 4 tarefas do Agendador do Windows às 17h (29/10 t14-1; 31/10 t12-1; 2/11 t12-2; 4/11 t12-3). Cada uma roda `marketing\motion\tati-flow\agendar\*.cmd`, que chama `scripts\meta-ig-reel-tati.mjs`. O script sobe o MP4 no bucket `meta-reels` do Supabase e publica. Não publica duas vezes (registro em `tati-flow\publicados.json`). Logs em `tati-flow\logs\`. Publicador local, sem deploy na Vercel.

## Vínculo Google perdido (27/10, correção sem commit)

- Caso Karla Rocha (perfil teste, 16/12): evento existia no Google, mas uma gravação em lote da agenda (`/api/consultas/sync`, sem log) apagou `google_event_id` e `google_profissional_id` 1 s depois da fila ligá-los. A verificação mostrava "sem evento" porque só olha o banco. Sessão religada à mão no banco.
- Correção no código: sync em lote não zera mais o vínculo (só edição do usuário, `enqueueGoogleSync`, pode); a verificação religa sozinha a sessão sem vínculo ao único evento da Turquesa no mesmo horário e cliente (log `religar_vinculo_perdido`), sem mexer no Google.

## Stories Trilha 1 agendados (26/10)

- 10 stories em `marketing/stories/trilha1/t1-01.png` a `t1-10.png`, publicados por `scripts/meta-ig-stories-trilha1.mjs --quadro N`.
- Tarefas do Windows "Turquesa Story Trilha1 01" a "10", só em 26/10, às 11:00, 11:53, 12:47, 13:40, 14:33, 15:27, 16:20, 17:13, 18:07 e 19:00.
- Token `META_IG_ACCESS_TOKEN` validado em 26/10: conta `@turquesaagenda` (Business), permissão de publicação ativa.
- Só funciona com o PC ligado e o usuário logado no horário. Se faltar algum, rodar o quadro à mão.
- Stories com a Tati: disclosure "Conteúdo feito com IA" está na imagem.

## Stories Trilha 2 (barbearias), agendados para 27/10 (26/10)

- 10 quadros em `marketing/stories/trilha2/t2-01.png` a `t2-10.png` (gerados por `marketing/stories/build_stories_trilha2.py`), publicados por `scripts/meta-ig-stories-trilha2.mjs --quadro N`.
- Tarefas do Windows "Turquesa Story Trilha2 01" a "10", só em 27/10, nos mesmos horários da Trilha 1 (11:00 a 19:00).
- Copy não foi revisada pelo Pedro antes do agendamento. Para cancelar, apagar as tarefas "Turquesa Story Trilha2" no Agendador de Tarefas.
- Sem Tati, então sem disclosure de IA; aviso no rodapé é só "Teste 30 dias grátis".

## Login de 23 e 26/10 com campanha desligada (26/10)

- Logins em 23/10 (2) e 26/10 (2), todos sem cookie de anúncio Meta (`meta_fbc`/`meta_fbp` vazios) e sem e-mail de ativação enviado.
- 23/10: duas contas sem cadastro de onboarding. 26/10: duas contas antigas, cadastradas em 05/06.
- Nenhum e-mail do Turquesa encontrado no Gmail dos últimos 14 dias. O banco não guarda origem (UTM/referrer), então não dá para dizer se foi Instagram orgânico ou link antigo.
- Conta nova `marcia...` (login 23/10 12:09, sem assinatura): o e-mail não está em nenhuma tabela do banco do robô do saaslicita (leitura, `prisma/dev.db`), então o robô não enviou nada para ela. Não está no público de Meta do e-mail de salões. Origem: orgânica (Instagram ou link), não confirmado pelo banco.

## Verificação de segurança PHP e certificados (23/10)

- PHP2Shell (CVE-2026-109618/109619): sem exposição direta identificada; projeto Next.js/Node.js, sem arquivos PHP/Composer encontrados.
- Produção consultada em 23/10: HTTP 200, CNAME `www` para `cname.vercel-dns.com`, resposta da Vercel; Cloudflare como DNS não oferece WAF nesse caminho. Certificado observado: Let's Encrypt YR1 → ISRG, fora das CAs eMudhra/emSign comprometidas. Isso não elimina risco de certificados forjados nas conexões de saída.
- **Correções no ar em 23/10 ~09h45 BRT, ainda sem commit/push:** Next 16.4.2, Auth.js beta.32, Sharp 0.35.5 e transitivas atualizadas; Nodemailer sem uso removido. Deploy direto `dpl_BRBttakGSbZmRYGHnyJ6vkGrk2rB`, base igual à produção anterior (`571c6fe`), somente correções de segurança. Próximos deploys devem incluir essas mudanças locais para não regredir. `npm audit --omit=dev`: 0 alertas; permanecem 5 pacotes de lint sinalizados por `braces`, sem correção indicada, fora das dependências de produção.
- **Pendente na Vercel:** build usa 24.22.1, mas função real usa **24.21.0** (confirmado em log de `/api/health/runtime`); preview diagnóstico da linha 22 usa 22.23.2. Ambos anteriores às correções 24.22.1 / 22.23.4. Plataforma só permite escolher a linha principal; patch depende do rollout gerenciado. Não considerar encerrado. `/api/health/runtime` retorna 503/`ok:false` enquanto a função não atende ao mínimo. WAF não protege respostas buscadas de outras APIs. Detalhes em `docs/SEGURANCA_NODE.md`.
- **Node local isolado atualizado:** `.tools/node-v24.22.1/node.exe`, SHA-256 oficial conferido; usar `./scripts/npm-seguro.ps1 run dev` (ou `build`/`node:check`). Instalação global 24.16.0 e processos existentes preservados para não afetar o saaslicita. `engines.node`, `.node-version` e guardas de build/dev/start exigem versão corrigida.
- Validação: build local e remoto ok; 7 testes públicos/touch passaram, 2 testes de clientes não executados por exigirem modo específico; testes antigos de cookies/tipos/modal legal ajustados. Varredura de 265 JS públicos sem chave privada ou JWT service_role encontrados. Domínio público: home/login 200, configuração de login ok, sessão anônima null, financeiro redireciona ao login. Nenhum segredo exibido e nenhum banco alterado.
- Triagem de dependências dos demais projetos, só leitura: MedSup 9 pacotes sinalizados, Musculini 3, saaslicita 16, protótipo conselheiro-de-negocios 1, automação WhatsApp Luyddy 11, StreamDex 7. Morar Perto e público Meta Luyddy: 0 no escopo de produção. Contagens são alertas por pacote, não prova de exploração; versões publicadas dos demais sites não foram confirmadas. Nenhum código/processo dos outros projetos foi alterado.
- Fontes: https://www.php.net/archive/2026.php ; https://blog.talosintelligence.com/compromised-intermediate-certificates/ ; https://nodejs.org/en/blog/vulnerability/october-2026-security-releases ; https://vercel.com/kb/bulletin/node-js-security-advisory

## Arquivos locais fora do Git (22/10)

- Decisão do Pedro: manter fora do versionamento os rascunhos de propaganda `docs/ads-preview/onda3v2-c3.png`, `onda3v2-c4.png` e `onda3v2-cards.html`, as orientações de agente em `.agents/rules/` e `.github/instructions/`, e a pesquisa `docs/resumos/2026-10-05-cal-ai-binhara.md`. Caminhos adicionados ao `.gitignore`.
- As imagens e o HTML Onda3 v2 já eram rastreados pelo Git; `.gitignore` não os desrastreia retroativamente. A remoção do rastreamento precisa entrar em um commit para deixar de aparecer como alteração.

## Primeiro uso do onboarding (22/10)

- Mudança local, sem commit/deploy: onboarding só mostra “Pronto” depois de preparar profissional, catálogo, horários e link público. Falhas agora ficam visíveis, permitem tentar de novo e preservam a pendência ao recarregar a página.
- Após liberar o Google, a agenda destaca compartilhar o link no WhatsApp ou testá-lo como cliente.

## Logins 17–18/10 + buraco do primeiro uso (18/10)

- **2 contas novas:** `med.trab7676@gmail.com` (Márcia Cristina Marques, WhatsApp 19 99620-8436) e `izadoraalves68@gmail.com`.
- **Márcia:** onboarding enxuto **funcionou** no Clarity (form → Ver minha agenda → Abrir agenda). Lead fraco pro vertical (e-mail `med.trab` = medicina do trabalho; Meta Advantage+). Google Drive+Calendar+Contatos conectados; **0 clientes / 0 sessões**. Depois do onboarding o gate pediu Reconectar Google; ela reconectou e saiu em ~8 s — o CTA Mandar link no WhatsApp (`?primeiro=1`) sumia porque o AgendaPageClient não monta enquanto o gate bloqueia e o OAuth voltava sem o flag.
- **Izadora:** só login (~09:23 BRT), sem perfil/onboarding; sem sessão Clarity (provável WebView/cookies). Outro prospect Meta bateu em login?error=Configuration e dead clicks no aviso in-app do Instagram.
- **Correção no ar (18/10):** `lib/primeiroUsoClient.ts` (flag no sessionStorage); onboarding CTA Liberar Google e abrir agenda; gate com copy Quase lá + redirect `/agenda?primeiro=1` na 1ª conexão; agenda restaura o banner WhatsApp após OAuth; InAppBrowserNotice no iOS prioriza copiar link. Rastro: `docs/resumos/2026-10-18-primeiro-uso-google-gate.md`.

## Onboarding enxuto / primeiro uso (16/10, fluxo atualizado 18/10)

- Cadastro mínimo: nome + WhatsApp + termos. Seed Corte/Escova/Manicure; CNPJ/endereço/serviços depois.
- Fluxo guiado **1 CTA por vez**:
  1. Após salvar → **Liberar Google e abrir agenda** (OAuth Drive+Calendar; atalho se já liberou)
  2. Na agenda (`?primeiro=1`, flag sobrevive ao OAuth) → **Mandar link no WhatsApp**
  3. Checklist “Comece por aqui”: WhatsApp → agenda → finalizar → Contatos (opcional por último)
- Trial continua **30 dias**.

## Fechamento do dia — copiar mensagem (15/10)

- No painel (`DashboardFechamentoDiaCard`) e no Financeiro → Repasse: botão **Copiar** ao lado do WhatsApp, para colar no WhatsApp Web/Desktop. Confirmação "Copiado" por 2 s.

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
## Aviso de falha ao finalizar sessão (28/10, sem commit)
- Caso real: no celular deu "Failed to fetch" ao finalizar, mas o log da Vercel mostrou `POST /api/clientes/:id/finalizar` 201 (gravou). A resposta se perdeu por queda de rede.
- Agora, erro de rede mostra `MSG_FINALIZAR_CLIENTE_SEM_CONEXAO` (confira a ficha, não lance de novo) em vez de "não foi possível registrar". Código em `lib/finalizarClienteFromAgenda.ts`, usado em `AgendaPageClient` e `DashboardAgendaHoje`.
- Rota `/finalizar` não é idempotente: não colocar retry automático sem chave por evento.
- Logs da Vercel: conector MCP dá 403 em logs; pelo painel (Chrome logado) funciona, aba Request Logs (retenção curta no plano Hobby).

## Mudanças locais sem commit

**No ar desde 15/10 ~10h05** (push até `f9d026b`, domínios promovidos com `npm run deploy:promote:wait`; SQL `db:meta-atribuicao` aplicado antes). Build ok; e2e: 4 ok, 3 falhas antigas (banner de cookies e touch-select, testes de junho desatualizados — corrigir os testes).

1. `b508d69` fila do Instagram a partir de 16/10.
2. `07756aa` verificação Google (bug da Yolanda).
3. `ef714f8` link da ficha sem localhost.
4. `a5aef0a` eventos Meta Lead/StartTrial.
- Ainda sem commit: `docs/ads-preview/onda3v2-*` (prévias de anúncio); não rastreados `.agents/rules`, `.github/instructions` (regras de agente), `CLAUDE.md` e `docs/resumos/`.
- **Claude Code (15/10):** `CLAUDE.md` da raiz só importa `AGENTS.md` + `.cursor/rules/*.mdc` (editar as regras lá, não duplicar). MCPs `clarity-turquesa` e `brave` copiados do Cursor para o `~/.claude.json`.
- As "correções de desempenho" do agente na nuvem não estão em nenhum ramo do GitHub (conferido em 15/10). A busca abrangente já existia no `master` (`lib/clienteSearch.ts`: sem acento/til/pontuação, tolera erro de digitação, telefone por dígitos).
- **Desempenho no ar desde 15/10 à tarde** (`0cb494d`, domínios promovidos; e2e igual ao anterior):
  - Lembretes WhatsApp: `/api/lembretes/pendentes` busca em paralelo; a promoção de bloqueios do Google (`promoteGoogleBloqueiosDeClientes`, no máx. 1x/10 min por conta) roda depois da resposta (`after()`). Cartão abre na hora com o último resultado do dia guardado no aparelho (`lib/lembretesCache.ts`) e não espera mais 1,4 s no painel.
  - Medição Clarity 08–15/10 (antes do deploy): agenda é a pior (LCP mobile ~9,9 s; INP no PC ~1,7 s); CLS 0,6–1,0 em geral; onboarding LCP mobile ~16 s.
  - **Medição real da agenda (15/10, PC, conta teste):** calendário só aparece ~16 s após abrir; ~15 chamadas `/api` em paralelo levando 2–6 s cada (até `/api/legal/consent-status` 2,1 s); `/api/perfil` chamado 2x; travadas de 1–2,3 s no navegador processando respostas. Causas: banco Supabase em **us-west-2 (Oregon)** e funções Vercel em **gru1 (São Paulo)** (~150–200 ms por consulta), e o callback `jwt` do login fazia 3 consultas (1 gravação) em toda chamada autenticada, no middleware e de novo na rota.
  - **No ar desde 15/10 à noite (`fc287c1`, domínios promovidos; build ok, e2e igual):** login, região `pdx1` (conferido: `x-vercel-id` gru1::pdx1), vazamento e agenda leve abaixo. **Medido 15/10 11h35 (PC, conta teste):** calendário em 2,7 s (antes ~16 s); chamadas `/api` em 0,3–0,8 s (antes 2–6 s); `/api/perfil` 1x; ainda 1 travada de 1,4 s no navegador. Conferir Clarity (celular) em alguns dias.
  - **Travada da agenda (15/10, no ar `0d71565`; medido: calendário 1,5 s, nenhuma travada >200 ms, CPU de `parseEventDate` 3,1 s → ~0):** perfil de CPU mostrou 3,1 s em `parseEventDate` chamada milhões de vezes pelo passo 2 de `dedupeConsultations` (n², 3x na abertura). Agora horários pré-calculados e pares fora de ±1 min descartados (resultado idêntico em 200 rodadas; 600 consultas 176→14 ms); `parseEventDate` guarda timestamp por string (até 5000); `scheduleSyncConsultasToServer`/`listConsultasPendingPush` saem na hora sem rascunho `local-*`; clientes da agenda esperam 5 s de verdade. Para medir, usar o Brave do Cursor na porta 9333 (perfil próprio); a 9222 é do robô do saaslicita.
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
