/** APIs de páginas públicas (ficha, agendar, convite) — sem onboarding/billing. */
export function isPublicApiPath(pathname: string): boolean {
  if (pathname.startsWith('/api/formulario/')) return true;
  if (pathname.startsWith('/api/public/')) return true;
  if (pathname.startsWith('/api/agendar/')) return true;
  if (pathname.startsWith('/api/calendario/adicionar/')) return true;
  if (pathname.startsWith('/api/convite/')) return true;
  return false;
}

/** Rotas permitidas com assinatura `expired` (login + pagar + backup). */
export function isSubscriptionExemptPath(pathname: string): boolean {
  if (pathname === '/dashboard/conta' || pathname.startsWith('/dashboard/conta/')) {
    return true;
  }
  if (pathname === '/backup' || pathname.startsWith('/backup/')) {
    return true;
  }
  if (pathname === '/api/conta' || pathname.startsWith('/api/conta/')) {
    return true;
  }
  if (pathname === '/login' || pathname.startsWith('/login/')) {
    return true;
  }
  if (pathname === '/auth/verificar-email' || pathname.startsWith('/auth/verificar-email/')) {
    return true;
  }
  if (
    pathname === '/privacidade' ||
    pathname === '/termos' ||
    pathname === '/planos' ||
    pathname === '/instalar' ||
    pathname === '/app'
  ) {
    return true;
  }
  if (pathname === '/api/bug-report') {
    return true;
  }
  return false;
}

export function isBillingEnforced(): boolean {
  return process.env.ASAAS_BILLING_ENFORCED !== 'false';
}
