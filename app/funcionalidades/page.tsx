import GuiaFuncionalidadesContent from '@/components/GuiaFuncionalidadesContent';
import { PRODUCT_NAME } from '@/lib/visual/brand';

export const metadata = {
  title: `Funcionalidades e como configurar | ${PRODUCT_NAME}`,
  description:
    'Guia completo do Turquesa Agenda: agenda, clientes, catálogo, financeiro, WhatsApp, Google e agendamento online para salões de beleza.',
};

export default function FuncionalidadesPage() {
  return <GuiaFuncionalidadesContent />;
}
