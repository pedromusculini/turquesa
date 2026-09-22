import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CANONICAL_APP_URL } from '@/lib/constants';
import { getAppSession } from '@/lib/getAppSession';
import { BRAND } from '@/lib/visual/brand';
import { THEME_BOOT_SCRIPT } from '@/lib/visual/theme';
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
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Turquesa Agenda',
    statusBarStyle: 'default',
    startupImage: [
      {
        url: '/splash-1290x2796.png',
        media:
          '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)',
      },
    ],
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
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="bg-[var(--brand-bg-page)] text-[var(--app-text)]">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
