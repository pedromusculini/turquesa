import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getAppSession } from '@/lib/getAppSession';
import { BRAND } from '@/lib/visual/brand';
import { Providers } from './providers';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: BRAND.colors.primary,
};

export const metadata: Metadata = {
  title: {
    default: 'Turquesa Agenda — Pare de perder cliente e horário no WhatsApp',
    template: '%s | Turquesa Agenda',
  },
  description:
    'Agenda, equipe, Google Calendar, clientes e financeiro num só lugar — feito para salão solo ou com equipe. 30 dias grátis, depois R$ 79,90/mês.',
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png', sizes: '32x32' }],
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Turquesa Agenda',
    statusBarStyle: 'default',
  },
  openGraph: {
    title: 'Pare de perder cliente e horário no WhatsApp',
    description:
      'Turquesa Agenda: sistema completo para salão com Google Calendar, clientes e financeiro. 30 dias grátis.',
    locale: 'pt_BR',
    type: 'website',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAppSession();
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50">
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
