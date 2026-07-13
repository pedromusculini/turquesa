import InstalarAppClient from '@/components/InstalarAppClient';

export const metadata = {
  title: { absolute: 'Turquesa Agenda' },
  description:
    'Instale o Turquesa Agenda na tela inicial do celular ou no computador — agenda e clientes sempre à mão.',
};

export default function InstalarPage() {
  return <InstalarAppClient />;
}
