import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAccessStateForUser } from '@/lib/googleAccountAccess';
import { getConnectedEquipeProfissional } from '@/lib/onboardingGate';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email || !session.googleSub) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const email = session.user.email.toLowerCase().trim();
    const state = await getAccessStateForUser(session.googleSub, email);
    const equipeProfissional = await getConnectedEquipeProfissional(
      session.googleSub,
      email,
    );

    return NextResponse.json({
      email: state.email,
      accessVerified: state.accessVerified,
      needsEmailVerification: state.needsEmailVerification,
      reverifyDueToInactivity: state.reverifyDueToInactivity,
      trialEligible: state.trialEligible,
      trialConsumed: state.trialConsumed,
      inactiveDaysThreshold: 30,
      equipeProfissional,
    });
  } catch (err) {
    console.error('[google-access/status]', err);
    return NextResponse.json(
      { error: 'Não foi possível verificar o acesso. Tente entrar novamente.' },
      { status: 500 },
    );
  }
}
