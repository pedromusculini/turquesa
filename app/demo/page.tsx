import type { Metadata } from 'next';
import DemoInterativa from '@/components/DemoInterativa';

export const metadata: Metadata = {
  title: 'Demonstração | Turquesa Agenda',
  description:
    'Teste a agenda do salão sem cadastro: autoagendamento, lembrete no WhatsApp e repasse da equipe.',
  alternates: { canonical: '/demo' },
};

export default function DemoPage() {
  return <DemoInterativa />;
}
