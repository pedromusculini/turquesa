import type { Metadata } from 'next';
import HomeClient from './HomeClient';

/** Título de conversão só na landing; demais páginas usam "Turquesa Agenda". */
export const metadata: Metadata = {
  title: {
    absolute: 'Pare de perder cliente e horário no WhatsApp | Turquesa Agenda',
  },
  description:
    'Agenda do salão + Google Calendar + financeiro. 30 dias grátis, sem cartão. Depois R$ 79,90/mês. Feito para salão solo ou com equipe.',
  openGraph: {
    title: 'Pare de perder cliente e horário no WhatsApp',
    description:
      'Agenda do salão + Google Calendar + financeiro. 30 dias grátis, sem cartão.',
  },
};

export default function Home() {
  return <HomeClient />;
}
