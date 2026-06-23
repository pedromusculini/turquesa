import type { MetadataRoute } from 'next';
import { ADMIN_API_PREFIX, ADMIN_PANEL_PATH } from '@/lib/constants';

const LEGACY_PANEL = '/naomexaaquiseucorno';
const LEGACY_API = '/api/naomexaaquiseucorno';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        ADMIN_PANEL_PATH,
        `${ADMIN_PANEL_PATH}/`,
        ADMIN_API_PREFIX,
        LEGACY_PANEL,
        `${LEGACY_PANEL}/`,
        LEGACY_API,
      ],
    },
  };
}
