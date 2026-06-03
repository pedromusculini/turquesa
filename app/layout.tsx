import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'Turquesa Agenda',
    template: '%s | Turquesa Agenda',
  },
  description:
    'Gestão para salões e estúdios de beleza — agenda, clientes no Google Drive, LGPD.',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-icon.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
