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
  title: 'Turquesa Agenda',
  description:
    'Agenda do salão + Google Calendar + financeiro. 30 dias grátis, sem cartão. Depois R$ 79,90/mês. Feito para salão solo ou com equipe.',
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
    title: 'Turquesa Agenda',
    description:
      'Agenda do salão + Google Calendar + financeiro. 30 dias grátis, sem cartão.',
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
