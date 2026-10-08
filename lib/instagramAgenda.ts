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
    data: '2026-10-12',
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
    data: '2026-10-14',
    imagem: 'post-05-cliente-sumida.jpg',
    legenda: `Quantas clientes não voltam há mais de 60 dias? 👀

A maioria não foi embora — só esqueceu. Uma mensagem no momento certo traz de volta.

No Turquesa, o painel mostra quem sumiu e já deixa a mensagem pronta no WhatsApp. Um toque por cliente.

Tem também a lista de aniversariantes do mês 🎂

#fidelizacao #clientesfieis #salaodebeleza #gestaodesalao #donadesalao`,
  },
  {
    data: '2026-10-16',
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
];
