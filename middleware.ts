import { auth } from '@/auth';
import {
  appendDevBypassSessionCookie,
  getDevMockMiddlewareAuth,
  isDevBypassAuthActive,
} from '@/lib/devBypassAuth';
import { NextResponse, type NextRequest } from 'next/server';
import type { Session } from 'next-auth';
import { getGoogleAccessFromDb } from '@/lib/requireGoogleAccess';
import { isInternalAdminEmail, isInternalApiPath, isInternalPath } from '@/lib/internalAdmin';
import { getSubscriptionAccess } from '@/lib/assinatura';
import {
  isBillingEnforced,
  isClienteFichaProfissionalApi,
  isClienteFichaProfissionalPage,
  isPublicApiPath,
  isSubscriptionExemptPath,
} from '@/lib/subscriptionPaths';
import { getConnectedEquipeProfissional, hasCompletedOnboarding, isOnboardingPath } from '@/lib/onboardingGate';
import {
  applyPendingMiddlewareGateCaches,
  readMiddlewareGateCache,
  type PendingMiddlewareGateCache,
} from '@/lib/middlewareAuthCache';

function resolveAuth(req: { auth: Session | null }): Session | null {
  if (isDevBypassAuthActive()) return getDevMockMiddlewareAuth();
  return req.auth ?? null;
}

async function finish(
  req: NextRequest,
  res: NextResponse,
  pendingGateCaches: PendingMiddlewareGateCache[] = [],
): Promise<NextResponse> {
  if (pendingGateCaches.length > 0) {
    await applyPendingMiddlewareGateCaches(res, pendingGateCaches);
  }
  return appendDevBypassSessionCookie(req, res);
}

/** Rotas públicas (landing, login, formulário cliente). `/` só casa a raiz. */
function isPublicPath(pathname: string, searchParams?: URLSearchParams): boolean {
  if (pathname === '/') return true;
  if (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/planos' ||
    pathname === '/instalar' ||
    pathname === '/app' ||
    pathname === '/privacidade' ||
    pathname === '/termos' ||
    pathname === '/paleta-cores' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/robots.txt'
  ) {
    return true;
  }
  if (pathname.startsWith('/f/')) {
    if (searchParams?.get('view') === 'profissional') return false;
    return true;
  }
  if (pathname.startsWith('/c/')) return true;
  if (pathname.startsWith('/agendar/')) return true;
  if (pathname.startsWith('/calendario/adicionar/')) return true;
  if (pathname.startsWith('/r/')) return true;
  if (pathname.startsWith('/convite/')) return true;
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
  if (pathname.startsWith('/api/formulario/')) {
    if (isClienteFichaProfissionalApi(pathname)) return false;
    return true;
  }
  if (pathname.startsWith('/api/public/')) return true;
  if (pathname.startsWith('/api/agendar/')) return true;
  if (pathname.startsWith('/api/calendario/adicionar/')) return true;
  if (pathname.startsWith('/api/convite/')) return true;
  if (pathname === '/api/auth/oauth-uris') return true;
  if (pathname === '/api/auth/google-callback') return true;
  if (pathname === '/api/webhooks/asaas') return true;
  if (pathname === '/api/bug-report') return true;

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
  const searchParams = req.nextUrl.searchParams;
  const fichaProfPage = isClienteFichaProfissionalPage(pathname, searchParams);
  const fichaProfApi = isClienteFichaProfissionalApi(pathname);
  const devBypass = isDevBypassAuthActive();
  const session = resolveAuth(req);
  const pendingGateCaches: PendingMiddlewareGateCache[] = [];
  const host =
    req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    req.headers.get('host')?.split(':')[0]?.trim() ||
    '';

  if (host === 'turquesaagenda.com.br') {
    const dest = new URL(
      req.nextUrl.pathname + req.nextUrl.search,
      'https://www.turquesaagenda.com.br',
    );
    return NextResponse.redirect(dest, 308);
  }

  if (host === 'medsupapp.com.br') {
    const dest = new URL(
      req.nextUrl.pathname + req.nextUrl.search,
      'https://www.turquesaagenda.com.br',
    );
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

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/portfolio-logos') ||
    pathname.startsWith('/public') ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/icon-192.png' ||
    pathname === '/icon-512.png' ||
    pathname === '/apple-icon.png'
  ) {
    return finish(req, NextResponse.next());
  }

  if (isInternalPath(pathname)) {
    const email = session?.user?.email?.toLowerCase().trim();
    if (isInternalApiPath(pathname)) {
      if (!email || !isInternalAdminEmail(email)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return finish(req, NextResponse.next());
    }
    if (!email || !isInternalAdminEmail(email)) {
      const notFoundUrl = new URL(req.url);
      notFoundUrl.pathname = '/not-found';
      notFoundUrl.search = '';
      return NextResponse.rewrite(notFoundUrl);
    }
    return finish(req, NextResponse.next());
  }

  if (!session?.user) {
    if (isPublicPath(pathname, searchParams) || isUnverifiedApiPath(pathname)) {
      return finish(req, NextResponse.next());
    }
    if (fichaProfApi) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (fichaProfPage || fichaProfApi) {
    const googleSub = session.googleSub;
    const email = session.user.email?.toLowerCase().trim();
    if (!googleSub || !email) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('erro', 'sessao');
      return NextResponse.redirect(loginUrl);
    }

    let accessVerified = devBypass;
    if (!devBypass) {
      if (await readMiddlewareGateCache(req, 'email', googleSub, email)) {
        accessVerified = true;
      } else {
        try {
          const access = await getGoogleAccessFromDb(googleSub, email);
          accessVerified = access.accessVerified;
          if (accessVerified) {
            pendingGateCaches.push({ kind: 'email', googleSub, email });
          }
        } catch (err) {
          console.error('[middleware] ficha profissional email check:', err);
          accessVerified = false;
        }
      }
    }

    if (!accessVerified) {
      const equipe = await getConnectedEquipeProfissional(googleSub, email);
      if (!equipe) {
        if (fichaProfApi) {
          return NextResponse.json(
            {
              error: 'Confirme seu e-mail com o código enviado antes de continuar.',
              code: 'EMAIL_VERIFICATION_REQUIRED',
            },
            { status: 403 },
          );
        }
        const verifyUrl = new URL('/auth/verificar-email', req.url);
        verifyUrl.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
        return NextResponse.redirect(verifyUrl);
      }
    }

    return finish(req, NextResponse.next(), pendingGateCaches);
  }

  // Formulário cliente, agendar, /r/…: público mesmo com sessão Google ativa
  if (isPublicPath(pathname, searchParams) || isPublicApiPath(pathname)) {
    return finish(req, NextResponse.next());
  }

  const googleSub = session.googleSub;
  const email = session.user.email;

  if (!googleSub || !email) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('erro', 'sessao');
    return NextResponse.redirect(loginUrl);
  }

  let accessVerified = devBypass;
  if (!devBypass) {
    if (await readMiddlewareGateCache(req, 'email', googleSub, email)) {
      accessVerified = true;
    } else {
      try {
        const access = await getGoogleAccessFromDb(googleSub, email);
        accessVerified = access.accessVerified;
        if (accessVerified) {
          pendingGateCaches.push({ kind: 'email', googleSub, email });
        }
      } catch (err) {
        console.error('[middleware] google access check:', err);
        accessVerified = false;
      }
    }
  }

  if (!accessVerified) {
    if (isUnverifiedPagePath(pathname) || isUnverifiedApiPath(pathname)) {
      return finish(req, NextResponse.next(), pendingGateCaches);
    }
    const equipe = await getConnectedEquipeProfissional(googleSub, email);
    if (equipe) {
      if (isOnboardingPath(pathname)) {
        return finish(req, NextResponse.next(), pendingGateCaches);
      }
      const onboardingUrl = new URL('/onboarding', req.url);
      onboardingUrl.searchParams.set(
        'callbackUrl',
        req.nextUrl.pathname + req.nextUrl.search,
      );
      return NextResponse.redirect(onboardingUrl);
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

  let onboardingDone = devBypass;
  if (!devBypass) {
    if (await readMiddlewareGateCache(req, 'onboarding', googleSub, email)) {
      onboardingDone = true;
    } else {
      try {
        onboardingDone = await hasCompletedOnboarding(email);
        if (onboardingDone) {
          pendingGateCaches.push({ kind: 'onboarding', googleSub, email });
        }
      } catch (err) {
        console.error('[middleware] onboarding check:', err);
        onboardingDone = false;
      }
    }
  }

  if (!onboardingDone) {
    if (isOnboardingPath(pathname) || isUnverifiedApiPath(pathname)) {
      return finish(req, NextResponse.next(), pendingGateCaches);
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

  if (!devBypass && isBillingEnforced() && !isSubscriptionExemptPath(pathname)) {
    if (await readMiddlewareGateCache(req, 'subscription', googleSub, email)) {
      return finish(req, NextResponse.next(), pendingGateCaches);
    }
    try {
      const sub = await getSubscriptionAccess(email);
      if (!sub.canUseApp) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            {
              error:
                'Assinatura inativa ou trial encerrado. Acesse /renovar para pagar ou /backup para exportar dados.',
              code: 'SUBSCRIPTION_EXPIRED',
            },
            { status: 402 },
          );
        }
        const renovarUrl = new URL('/renovar', req.url);
        return NextResponse.redirect(renovarUrl);
      }
      pendingGateCaches.push({ kind: 'subscription', googleSub, email });
    } catch (err) {
      console.error('[middleware] subscription check:', err);
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Não foi possível validar a assinatura.', code: 'SUBSCRIPTION_CHECK_FAILED' },
          { status: 503 },
        );
      }
      const renovarUrl = new URL('/renovar', req.url);
      return NextResponse.redirect(renovarUrl);
    }
  }

  return finish(req, NextResponse.next(), pendingGateCaches);
});

export const config = {
  // Do not run app middleware on Auth.js routes (avoids callback/error failures)
  matcher: [
    '/((?!api/auth|api/webhooks|_next/static|_next/image|favicon.ico|favicon.svg|favicon.png|apple-icon.svg|apple-icon.png|icon-192.png|icon-512.png|manifest.webmanifest|icon.svg|portfolio-logos|public).*)',
  ],
};
