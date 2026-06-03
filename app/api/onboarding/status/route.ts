import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getDevBypassIdentity, isDevBypassAuthActive } from '@/lib/devBypassAuth';
import {
  getGoogleAccessForSession,
  googleAccessDeniedResponse,
} from '@/lib/requireGoogleAccess';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
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
      return NextResponse.json({ authenticated: false, onboardingCompleted: false });
    }

    if (isDevBypassAuthActive()) {
      return NextResponse.json(
        {
          authenticated: true,
          onboardingCompleted: true,
          email: session.user.email,
          devBypass: true,
        },
        { headers: { 'Cache-Control': 'no-store, private' } },
      );
    }

    const access = await getGoogleAccessForSession(session);
    if (!access?.accessVerified) {
      return googleAccessDeniedResponse();
    }

    const email = session.user.email.toLowerCase().trim();
    const { data, error } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('onboarding_completed')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('[onboarding/status] lookup:', error);
    }

    return NextResponse.json(
      {
        authenticated: true,
        onboardingCompleted: data?.onboarding_completed === true,
        email: session.user.email,
      },
      { headers: { 'Cache-Control': 'no-store, private' } },
    );
  } catch (error) {
    console.error('[onboarding/status] Erro:', error);
    return NextResponse.json({ authenticated: false, onboardingCompleted: false });
  }
}
