import type { MetadataRoute } from 'next';
import { CANONICAL_APP_URL } from '@/lib/constants';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths = ['/', '/funcionalidades', '/instalar', '/termos', '/privacidade'] as const;

  return paths.map((path) => ({
    url: `${CANONICAL_APP_URL}${path === '/' ? '' : path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path === '/funcionalidades' ? 0.8 : 0.4,
  }));
}
