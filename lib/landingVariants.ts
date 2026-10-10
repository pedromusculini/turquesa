/**
 * Message match por criativo: o link do anúncio leva `?v=<variante>`.
 * Sem `v` (orgânico) usa `whatsapp`.
 */
export const LANDING_VARIANTS = {
  whatsapp: {
    h1: 'Pare de perder cliente e horário no WhatsApp',
    sub: 'Autoagenda + WhatsApp incluso + horário na agenda Google. 30 dias sem cartão — veja o dia a dia ficar mais organizado.',
    finalH2: 'Pare de perder cliente e horário no WhatsApp',
  },
  autoagenda: {
    h1: 'Ela marca sozinha. Sem mensagens no vácuo.',
    sub: 'Mande o link: a cliente escolhe o horário vago, se cadastra e o agendamento cai direto na agenda Google da profissional.',
    finalH2: 'Sua cliente marca sozinha. Você só atende.',
  },
  barbearia: {
    h1: 'O cliente marca sozinho. Você não para o corte.',
    sub: 'Link de agendamento que cai direto na agenda Google de cada barbeiro. Sem responder “tem horário?” no meio do atendimento.',
    finalH2: 'Agenda cheia sem largar a máquina',
  },
  google: {
    h1: 'A agenda do salão no Google Agenda de cada profissional',
    sub: 'Sem app novo para a equipe: cada uma vê os horários no celular. A cliente marca pelo link e cai direto ali. Fichas e financeiro ficam no Google Drive do seu salão.',
    finalH2: 'Seu salão organizado no Google que você já usa',
  },
} as const;

export type LandingVariant = keyof typeof LANDING_VARIANTS;

export function parseLandingVariant(value: string | string[] | undefined): LandingVariant {
  const v = Array.isArray(value) ? value[0] : value;
  return v && Object.hasOwn(LANDING_VARIANTS, v) ? (v as LandingVariant) : 'whatsapp';
}
