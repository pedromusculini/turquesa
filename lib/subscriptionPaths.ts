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
  if (pathname === '/privacidade' || pathname === '/termos' || pathname === '/planos') {
    return true;
  }
  return false;
}

export function isBillingEnforced(): boolean {
  return process.env.ASAAS_BILLING_ENFORCED !== 'false';
}
