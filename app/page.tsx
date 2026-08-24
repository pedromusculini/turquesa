import type { Metadata } from 'next';
import HomeClient from './HomeClient';

/** Título de conversão só na landing; demais páginas usam "Turquesa Agenda". */
export const metadata: Metadata = {
  title: {
    absolute: 'Pare de perder cliente e horário no WhatsApp | Turquesa Agenda',
  },
  description:
    'Autoagenda + WhatsApp incluso + horário na agenda Google. 30 dias sem cartão — veja o dia a dia mais organizado. Depois R$ 79,90/mês.',
  openGraph: {
    title: 'Pare de perder cliente e horário no WhatsApp',
    description:
      'A cliente marca sozinha, cai no Google. WhatsApp incluso no plano, sem taxa extra. 30 dias grátis, sem cartão.',
  },
};

export default function Home() {
  return <HomeClient />;
}
