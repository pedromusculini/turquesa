import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getConnectedEquipeProfissional } from '@/lib/onboardingGate';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getDevBypassIdentity, isDevBypassAuthActive } from '@/lib/devBypassAuth';
import {
  getGoogleAccessForSession,
  googleAccessDeniedResponse,
} from '@/lib/requireGoogleAccess';

export async function GET() {
  try {
    if (isDevBypassAuthActive()) {
      const { email } = getDevBypassIdentity();
      return NextResponse.json(
        {
          authenticated: true,
          onboardingCompleted: true,
          email,
          devBypass: true,
        },
        { headers: { 'Cache-Control': 'no-store, private' } },
      );
    }

    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ authenticated: false, onboardingCompleted: false });
    }

    const email = session.user.email.toLowerCase().trim();
    const access = await getGoogleAccessForSession(session);
    const equipeProfissional =
      session.googleSub
        ? await getConnectedEquipeProfissional(session.googleSub, email)
        : null;

    if (!access?.accessVerified && !equipeProfissional) {
      return googleAccessDeniedResponse();
    }

    const { data, error } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('onboarding_completed')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('[onboarding/status] lookup:', error);
    }

    const onboardingCompleted = data?.onboarding_completed === true;

    return NextResponse.json(
      {
        authenticated: true,
        onboardingCompleted,
        equipeProfissional,
        email: session.user.email,
      },
      { headers: { 'Cache-Control': 'no-store, private' } },
    );
  } catch (error) {
    console.error('[onboarding/status] Erro:', error);
    return NextResponse.json({ authenticated: false, onboardingCompleted: false });
  }
}
