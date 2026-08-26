import type { Metadata } from 'next';
import { CANONICAL_APP_URL } from '@/lib/constants';
import HomeClient from './HomeClient';

/** Título de conversão só na landing; demais páginas usam "Turquesa Agenda". */
export const metadata: Metadata = {
  title: {
    absolute: 'Pare de perder cliente e horário no WhatsApp | Turquesa Agenda',
  },
  description:
    'Autoagenda + WhatsApp incluso + horário na agenda Google. 30 dias sem cartão — veja o dia a dia mais organizado. Depois R$ 79,90/mês.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Pare de perder cliente e horário no WhatsApp',
    description:
      'A cliente marca sozinha, cai no Google. WhatsApp incluso no plano, sem taxa extra. 30 dias grátis, sem cartão.',
    url: CANONICAL_APP_URL,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Turquesa Agenda — pare de perder cliente no WhatsApp',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pare de perder cliente e horário no WhatsApp',
    description:
      'A cliente marca sozinha, cai no Google. WhatsApp incluso no plano, sem taxa extra. 30 dias grátis, sem cartão.',
    images: ['/og.png'],
  },
};

export default function Home() {
  return <HomeClient />;
}
