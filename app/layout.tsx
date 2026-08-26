import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CANONICAL_APP_URL } from '@/lib/constants';
import { getAppSession } from '@/lib/getAppSession';
import { BRAND } from '@/lib/visual/brand';
import { Providers } from './providers';

const DEFAULT_DESCRIPTION =
  'Agenda do salão + Google Calendar + financeiro. 30 dias grátis, sem cartão. Depois R$ 79,90/mês. Feito para salão solo ou com equipe.';

const OG_IMAGE = {
  url: '/og.png',
  width: 1200,
  height: 630,
  alt: 'Turquesa Agenda — autoagenda e Google Calendar para salões',
} as const;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: BRAND.colors.primary,
};

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_APP_URL),
  title: 'Turquesa Agenda',
  description: DEFAULT_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
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
    url: CANONICAL_APP_URL,
    siteName: 'Turquesa Agenda',
    locale: 'pt_BR',
    type: 'website',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Turquesa Agenda',
    description:
      'Agenda do salão + Google Calendar + financeiro. 30 dias grátis, sem cartão.',
    images: [OG_IMAGE.url],
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
