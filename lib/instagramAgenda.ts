/**
 * Posts do @turquesaagenda publicados pelo cron `/api/cron/instagram-posts` (17h e 19h BRT).
 * Arquivos no bucket público `meta-posts` do Supabase: imagem JPEG (feed) ou vídeo MP4 9:16 (Reels).
 */
export type InstagramPostAgendado = {
  /** Dia de publicação (America/Sao_Paulo), YYYY-MM-DD. */
  data: string;
  /** Hora BRT de um dos disparos do cron em `vercel.json` (17 ou 19). Padrão: 19. */
  hora?: 17 | 19;
  imagem?: string;
  /** Reels: MP4 vertical no bucket `meta-posts`. */
  video?: string;
  legenda: string;
};

export const INSTAGRAM_AGENDA: InstagramPostAgendado[] = [
  {
    data: '2026-10-08',
    hora: 17,
    video: 'reel-s12b-pitch-motion.mp4',
    legenda: `Você atende com as mãos. Não dá pra parar a cliente no meio pra responder WhatsApp. 💅

O Turquesa cuida da parte chata enquanto você trabalha:
📲 A cliente marca sozinha pelo seu link
💰 Catálogo com preço e tempo de cada serviço
📅 Agenda da equipe sincronizada com o Google
💬 Clientes sumidas com a mensagem pronta pro WhatsApp

Não é só agenda. É o painel do salão.

30 dias grátis, sem cartão. Depois, R$ 79,90/mês.
👉 Link na bio: turquesaagenda.com.br

Voz e cenas de abertura feitas com IA. Telas reais do sistema.

#salaodebeleza #manicure #lashdesigner #agendamentoonline #donadesalao #turquesaagenda`,
  },
  {
    data: '2026-10-07',
    imagem: 'post-02-mensagens.jpg',
    legenda: `Salva esse post e copia as mensagens 💬

1️⃣ Quando perguntarem horário:
"Oi! Pra ficar mais fácil, marca direto aqui que já aparece tudo que tenho livre 👉 [seu link]"

2️⃣ Lembrete 1 dia antes:
"Oi, [nome]! Passando pra lembrar do seu horário amanhã às [hora]. Posso confirmar? 💇‍♀️"

3️⃣ Cliente sumida há 60 dias:
"Oi, [nome]! Tô com uns horários bons essa semana, bora marcar aquele [serviço]? 😊"

No Turquesa essas mensagens já ficam prontas — é um toque e abre o WhatsApp com tudo preenchido.

#dicasparasalao #whatsappbusiness #salaodebeleza #donadesalao #empreendedorismofeminino`,
  },
  {
    data: '2026-10-09',
    imagem: 'post-03-comissao.jpg',
    legenda: `Você sabe quanto sobra pro salão depois da comissão? 🧮

Exemplo de um serviço de R$ 100 no cartão:
💳 Taxa da maquininha (3,6%): R$ 3,60
✂️ Comissão da profissional (50%): R$ 48,20
🏠 Fica pro salão: R$ 48,20

A taxa sai ANTES da comissão — senão o salão paga a taxa sozinho.

No Turquesa você finaliza o atendimento e essa conta sai pronta, por profissional, no fim do mês.

#comissao #financeirodosalao #gestaodesalao #salaodebeleza #donadesalao`,
  },
  {
    data: '2026-10-10',
    hora: 17,
    video: 'reel-t02-coisas-dona-salao.mp4',
    legenda: `Qual dessas 3 é você? Comenta 1, 2 ou 3 👇

1. “Tem horário?” com a mão cheia de esmalte
2. Marcou, confirmou… e não veio
3. Agenda vazia e cliente sumida

Narração feita com IA.

#salaodebeleza #manicure #nailart #lash #donadesalao`,
  },
  {
    data: '2026-10-11',
    imagem: 'post-04-link-bio.jpg',
    legenda: `Sua cliente abre seu Instagram às 23h e quer marcar. Ela vai ter que esperar você responder amanhã? 🌙

Coloca o link de agendamento na bio:
1. Copia seu link no painel do Turquesa
2. Instagram → Editar perfil → Links → Adicionar link
3. Fixa um story "Como agendar" nos destaques

Ela vê os horários livres, marca e o horário cai direto na sua agenda Google.

#instagramparasalao #agendamentoonline #salaodebeleza #dicasdeinstagram`,
  },
  {
    data: '2026-10-12',
    hora: 17,
    video: 'reel-t03-pov-tem-horario.mp4',
    legenda: `POV: no meio de uma fibra e chega “tem horário amanhã?” 😩

Você para tudo pra responder ou deixa a cliente esperando? Conta aqui 👇

Narração feita com IA.

#salaodebeleza #manicure #unhasdegel #nailart #donadesalao`,
  },
  {
    data: '2026-10-13',
    imagem: 'post-05-cliente-sumida.jpg',
    legenda: `Quantas clientes não voltam há mais de 60 dias? 👀

A maioria não foi embora — só esqueceu. Uma mensagem no momento certo traz de volta.

No Turquesa, o painel mostra quem sumiu e já deixa a mensagem pronta no WhatsApp. Um toque por cliente.

Tem também a lista de aniversariantes do mês 🎂

#fidelizacao #clientesfieis #salaodebeleza #gestaodesalao #donadesalao`,
  },
  {
    data: '2026-10-14',
    hora: 17,
    video: 'reel-t04-letras-miudas.mp4',
    legenda: `Antes de assinar qualquer sistema de salão, lê as letrinhas miúdas 🔎

Contrato de 1 ano, módulo extra, cobrança por atendente… qual pegadinha já te pegou? Conta aqui 👇

Narração feita com IA.

#salaodebeleza #manicure #nailart #lash #donadesalao`,
  },
  {
    data: '2026-10-15',
    imagem: 'post-06-demo.jpg',
    legenda: `Sem cadastro, sem cartão, sem vendedor te ligando 😅

Abre a demo e testa:
✅ Finalizar um atendimento e ver o repasse
✅ Marcar como se fosse a cliente
✅ Ver o lembrete pronto pro WhatsApp

Gostou? São 30 dias grátis no seu salão.

👉 turquesaagenda.com.br/demo (link na bio)

#salaodebeleza #agendaonline #sistemaparasalao #donadesalao #cabeleireira`,
  },
  {
    data: '2026-10-16',
    hora: 17,
    video: 'reel-t05-cobra-por-cadeira.mp4',
    legenda: `Contratei mais uma manicure e o sistema aumentou a mensalidade. Faz sentido isso? 🙃

Seu sistema cobra por profissional? Conta aqui 👇

Narração feita com IA. Telas da demonstração do sistema.

#salaodebeleza #manicure #nailart #donadesalao #equipe`,
  },
  {
    data: '2026-10-17',
    imagem: 'post-07-equipe-um-preco.jpg',
    legenda: `Contratou mais uma profissional? A mensalidade não muda. 💅

Tem sistema que cobra por profissional: o salão cresce e a conta cresce junto.

No Turquesa é um preço só, com a equipe toda:
✅ Agenda de cada uma, sincronizada no Google dela
✅ Comissão calculada, já descontando a taxa da maquininha
✅ 1 ou 15 profissionais: R$ 79,90/mês

30 dias grátis, sem cartão.
👉 Link na bio: turquesaagenda.com.br

#salaodebeleza #gestaodesalao #comissao #donadesalao #sistemaparasalao`,
  },
  {
    data: '2026-10-18',
    hora: 17,
    video: 'reel-t06-pacote-quantas-faltam.mp4',
    legenda: `“Amiga, quantas sessões faltam do meu pacote?” 🥲 Quem vende pacote já ouviu isso toda semana.

Você vende pacote no salão? Como controla hoje? 👇

Narração feita com IA.

#salaodebeleza #lash #estetica #donadesalao #pacotedesessoes`,
  },
  {
    data: '2026-10-19',
    imagem: 'post-08-pacote.jpg',
    legenda: `Pacote vendido = sessões pagas antes da cliente sentar. O difícil é o controle. 📋

No Turquesa:
✨ Finalizou a sessão, a mensagem já vem pronta: “Sessão 3 de 10”, com as datas de todas
📲 Um toque e abre o seu WhatsApp pra enviar
🧾 Gostou? Vende o pacote no fechamento, já contando a sessão de hoje

A cliente paga o pacote no seu salão, do seu jeito. O sistema lança no financeiro e controla as sessões.

Pacote não é módulo extra: vem no mesmo preço.

#pacotedesessoes #lashdesigner #estetica #salaodebeleza #donadesalao`,
  },
  {
    data: '2026-10-20',
    hora: 17,
    video: 'reel-t07-vitrine-com-concorrente.mp4',
    legenda: `Você manda sua cliente agendar numa vitrine onde aparecem os outros salões? 👀

Onde sua cliente agenda hoje? Conta aqui 👇

Narração feita com IA. Telas da demonstração do sistema.

#salaodebeleza #manicure #nailart #donadesalao #agendamentoonline`,
  },
  {
    data: '2026-10-21',
    imagem: 'post-09-seu-link.jpg',
    legenda: `Seu link de agendamento ou a vitrine dos outros salões? 👀

Tem app que coloca seu salão numa lista… com a concorrência do lado.

No Turquesa:
🌐 Site próprio do salão, com a sua cara
📲 A cliente agenda no seu link: seus serviços, sua equipe, seus horários
📅 O horário cai direto na agenda Google da profissional

Só o seu salão aparece.

30 dias grátis · 👉 link na bio

#agendamentoonline #salaodebeleza #instagramparasalao #donadesalao #manicure`,
  },
  {
    data: '2026-10-22',
    hora: 17,
    video: 'reel-t08-whatsapp-por-mensagem.mp4',
    legenda: `Cada “oi” pra cliente custando dinheiro? 💸 Tem sistema que cobra por mensagem de WhatsApp.

Você paga por mensagem hoje? Conta aqui 👇

Narração feita com IA. Telas da demonstração do sistema.

#salaodebeleza #manicure #whatsappbusiness #donadesalao #nailart`,
  },
  {
    data: '2026-10-23',
    imagem: 'post-10-whatsapp-sem-taxa.jpg',
    legenda: `Quanto custa um “oi” pra sua cliente? No Turquesa: R$ 0,00. 💬

Lembrete, confirmação, boas-vindas com link, cliente sumida… a mensagem já vem pronta, com o link de agendar e o endereço.

Você toca, o seu WhatsApp abre e você envia. Não é robô: é você — e a cliente sente isso.

Sem taxa por mensagem. R$ 79,90/mês, 30 dias grátis.

#whatsappbusiness #salaodebeleza #atendimento #donadesalao #dicasparasalao`,
  },
  {
    data: '2026-10-25',
    imagem: 'post-11-calculadora-comissao.jpg',
    legenda: `Mesma coloração de R$ 180, três resultados diferentes. 🧮

💚 PIX: profissional R$ 90,00 · salão R$ 90,00
💳 Débito (1,99%): R$ 88,21 · R$ 88,21
💳 Crédito (3,6%): R$ 86,76 · R$ 86,76

A taxa da maquininha sai ANTES da comissão — senão o salão paga a taxa sozinho.

No Turquesa você cadastra as taxas da sua maquininha e a conta sai pronta a cada atendimento finalizado. Testa na demo, sem cadastro: turquesaagenda.com.br/demo

Salva pra mostrar pra equipe 📌

#comissao #financeirodosalao #gestaodesalao #salaodebeleza #donadesalao`,
  },
  {
    data: '2026-10-27',
    imagem: 'post-12-anual.jpg',
    legenda: `12 meses pelo preço de 10. 🗓️

Plano anual do Turquesa: 12x de R$ 66,58 sem juros no cartão, ou R$ 799 no PIX.
✅ Equipe toda incluída, sem taxa por profissional
✅ Não renova sozinho e não tem multa
✅ Prefere mensal? R$ 79,90 no cartão ou no PIX

E antes de tudo: 30 dias grátis, sem cartão.
👉 Link na bio: turquesaagenda.com.br

#salaodebeleza #gestaodesalao #sistemaparasalao #donadesalao #empreendedorismofeminino`,
  },
  {
    data: '2026-10-29',
    imagem: 'post-13-origem-cliente.jpg',
    legenda: `Você paga anúncio e não sabe se alguma cliente veio dele? 😅

No relatório de clientes do Turquesa:
📍 De onde veio cada cliente (Instagram, indicação, anúncio…)
💰 Quanto custou trazer cada uma
🔁 Quem veio uma vez só, numa lista com a mensagem pronta pro WhatsApp

Menos achismo, mais cliente voltando.

30 dias grátis · 👉 link na bio

#marketingparasalao #salaodebeleza #gestaodesalao #donadesalao #clientesfieis`,
  },
];
