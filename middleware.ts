import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getGoogleAccessFromDb } from '@/lib/requireGoogleAccess';
import { isInternalAdminEmail, isInternalPath } from '@/lib/internalAdmin';
import { getSubscriptionAccess } from '@/lib/assinatura';
import { isBillingEnforced, isSubscriptionExemptPath } from '@/lib/subscriptionPaths';
import { hasCompletedOnboarding, isOnboardingPath } from '@/lib/onboardingGate';

/** Rotas públicas (landing, login, formulário paciente). `/` só casa a raiz. */
function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  if (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/planos' ||
    pathname === '/privacidade' ||
    pathname === '/termos'
  ) {
    return true;
  }
  if (pathname.startsWith('/f/')) return true;
  if (pathname.startsWith('/agendar/')) return true;
  if (pathname.startsWith('/calendario/adicionar/')) return true;
  if (pathname.startsWith('/auth/verify-email')) return true;
  return false;
}

/** Fluxos de cadastro por e-mail/senha desativados — apenas Google */
const emailSignupRoutes = [
  '/register',
  '/auth/cadastro',
  '/auth/choose-plan',
  '/auth/verify-code',
  '/login/register',
];

/** APIs permitidas sem confirmação de e-mail (login + envio/validação do código). */
function isUnverifiedApiPath(pathname: string): boolean {
  if (pathname.startsWith('/api/health/')) return true;
  if (pathname.startsWith('/api/auth/google-access')) return true;
  if (pathname.startsWith('/api/formulario/')) return true;
  if (pathname.startsWith('/api/agendar/')) return true;
  if (pathname.startsWith('/api/calendario/adicionar/')) return true;
  if (pathname === '/api/auth/oauth-uris') return true;
  if (pathname === '/api/auth/google-callback') return true;
  if (pathname === '/api/webhooks/asaas') return true;

  const nextAuthPublic = [
    '/api/auth/signin',
    '/api/auth/callback',
    '/api/auth/csrf',
    '/api/auth/providers',
    '/api/auth/session',
    '/api/auth/signout',
    '/api/auth/error',
  ];
  return nextAuthPublic.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Páginas permitidas com login Google mas e-mail ainda não confirmado. */
function isUnverifiedPagePath(pathname: string): boolean {
  return (
    pathname === '/auth/verificar-email' ||
    pathname.startsWith('/auth/verificar-email/') ||
    pathname === '/login' ||
    pathname.startsWith('/login/')
  );
}

export default auth(async (req) => {
  const pathname = req.nextUrl.pathname;
  const host =
    req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    req.headers.get('host')?.split(':')[0]?.trim() ||
    '';

  if (host === 'medsupapp.com.br') {
    const dest = new URL(req.nextUrl.pathname + req.nextUrl.search, 'https://www.medsupapp.com.br');
    return NextResponse.redirect(dest, 308);
  }

  if (
    emailSignupRoutes.some(
      (route) => pathname === route || pathname.startsWith(route + '/'),
    )
  ) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('acesso', 'google');
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/public')) {
    return NextResponse.next();
  }

  if (isInternalPath(pathname)) {
    const email = req.auth?.user?.email?.toLowerCase().trim();
    if (pathname.startsWith('/api/naomexaaquiseucorno')) {
      if (!email || !isInternalAdminEmail(email)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.next();
    }
    if (!email || !isInternalAdminEmail(email)) {
      const notFoundUrl = new URL(req.url);
      notFoundUrl.pathname = '/not-found';
      notFoundUrl.search = '';
      return NextResponse.rewrite(notFoundUrl);
    }
    return NextResponse.next();
  }

  if (!req.auth?.user) {
    if (isPublicPath(pathname) || isUnverifiedApiPath(pathname)) {
      return NextResponse.next();
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const googleSub = (req.auth as { googleSub?: string }).googleSub;
  const email = req.auth.user.email;

  if (!googleSub || !email) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('erro', 'sessao');
    return NextResponse.redirect(loginUrl);
  }

  let accessVerified = false;
  try {
    const access = await getGoogleAccessFromDb(googleSub, email);
    accessVerified = access.accessVerified;
  } catch (err) {
    console.error('[middleware] google access check:', err);
    accessVerified = false;
  }

  if (!accessVerified) {
    if (isUnverifiedPagePath(pathname) || isUnverifiedApiPath(pathname)) {
      return NextResponse.next();
    }
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          error: 'Confirme seu e-mail com o código enviado antes de continuar.',
          code: 'EMAIL_VERIFICATION_REQUIRED',
        },
        { status: 403 },
      );
    }
    const verifyUrl = new URL('/auth/verificar-email', req.url);
    if (pathname !== '/auth/verificar-email') {
      const dest = req.nextUrl.pathname + req.nextUrl.search;
      verifyUrl.searchParams.set('callbackUrl', dest);
    }
    return NextResponse.redirect(verifyUrl);
  }

  let onboardingDone = false;
  try {
    onboardingDone = await hasCompletedOnboarding(email);
  } catch (err) {
    console.error('[middleware] onboarding check:', err);
    onboardingDone = false;
  }

  if (!onboardingDone) {
    if (isOnboardingPath(pathname) || isUnverifiedApiPath(pathname)) {
      return NextResponse.next();
    }
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          error: 'Complete seu cadastro em /onboarding antes de continuar.',
          code: 'ONBOARDING_REQUIRED',
        },
        { status: 403 },
      );
    }
    const onboardingUrl = new URL('/onboarding', req.url);
    if (!isOnboardingPath(pathname)) {
      onboardingUrl.searchParams.set(
        'callbackUrl',
        req.nextUrl.pathname + req.nextUrl.search,
      );
    }
    return NextResponse.redirect(onboardingUrl);
  }

  if (isBillingEnforced() && !isSubscriptionExemptPath(pathname)) {
    try {
      const sub = await getSubscriptionAccess(email);
      if (!sub.canUseApp) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            {
              error:
                'Assinatura inativa ou trial encerrado. Acesse Minha conta para pagar ou exportar backup.',
              code: 'SUBSCRIPTION_EXPIRED',
            },
            { status: 402 },
          );
        }
        const contaUrl = new URL('/dashboard/conta', req.url);
        contaUrl.searchParams.set('expired', '1');
        return NextResponse.redirect(contaUrl);
      }
    } catch (err) {
      console.error('[middleware] subscription check:', err);
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Não foi possível validar a assinatura.', code: 'SUBSCRIPTION_CHECK_FAILED' },
          { status: 503 },
        );
      }
      const contaUrl = new URL('/dashboard/conta', req.url);
      contaUrl.searchParams.set('expired', '1');
      return NextResponse.redirect(contaUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  // Do not run app middleware on Auth.js routes (avoids callback/error failures)
  matcher: [
    '/((?!api/auth|api/webhooks|_next/static|_next/image|favicon.ico|favicon.svg|apple-icon.svg|icon.svg|public).*)',
  ],
};
