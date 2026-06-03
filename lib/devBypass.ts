/** Re-export — use `lib/devBypassAuth.ts` as implementation. */
export {
  applyDevBypassToToken,
  appendDevBypassSessionCookie,
  DEV_SESSION_COOKIE_NAME,
  DEV_SESSION_COOKIE_PLAIN,
  DEV_SESSION_COOKIE_SECURE,
  getDevBypassIdentity,
  getDevMockMiddlewareAuth,
  getDevMockSession,
  isDevBypassAuthActive,
  isDevLocalCompiledAllowed,
  resolveDevSessionCookieName,
} from '@/lib/devBypassAuth';
