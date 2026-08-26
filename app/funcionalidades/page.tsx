import GuiaFuncionalidadesContent from '@/components/GuiaFuncionalidadesContent';

export const metadata = {
  title: { absolute: 'Funcionalidades | Turquesa Agenda' },
  description:
    'Guia completo do Turquesa Agenda: agenda, clientes, catálogo, financeiro, WhatsApp, Google e agendamento online para salões de beleza.',
  alternates: { canonical: '/funcionalidades' },
};

export default function FuncionalidadesPage() {
  return <GuiaFuncionalidadesContent />;
}
