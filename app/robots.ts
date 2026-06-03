import type { MetadataRoute } from 'next';
import { ADMIN_API_PREFIX, ADMIN_PANEL_PATH } from '@/lib/constants';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [ADMIN_PANEL_PATH, `${ADMIN_PANEL_PATH}/`, ADMIN_API_PREFIX],
    },
  };
}
