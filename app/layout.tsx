import type { Metadata } from 'next';
import './globals.css';
import { getAppSession } from '@/lib/getAppSession';
import { BRAND } from '@/lib/visual/brand';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'Turquesa Agenda',
    template: '%s | Turquesa Agenda',
  },
  description:
    'Gestão para salões e estúdios de beleza — agenda, clientes no Google Drive, LGPD.',
  themeColor: BRAND.colors.primary,
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png', sizes: '32x32' }],
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
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
