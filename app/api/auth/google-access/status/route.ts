import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAccessStateForUser } from '@/lib/googleAccountAccess';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !session.googleSub) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const state = await getAccessStateForUser(
    session.googleSub,
    session.user.email,
  );

  return NextResponse.json({
    email: state.email,
    accessVerified: state.accessVerified,
    needsEmailVerification: state.needsEmailVerification,
    reverifyDueToInactivity: state.reverifyDueToInactivity,
    trialEligible: state.trialEligible,
    trialConsumed: state.trialConsumed,
    inactiveDaysThreshold: 30,
  });
}
