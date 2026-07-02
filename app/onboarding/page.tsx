import { Suspense } from 'react';
import { auth } from '@/auth';
import { getConnectedEquipeProfissional } from '@/lib/onboardingGate';
import OnboardingPageClient from './OnboardingPageClient';

export default async function OnboardingPage() {
  const session = await auth();
  let initialEquipeProfissional = null;
  let equipeCheckedOnServer = false;

  if (session?.user?.email) {
    equipeCheckedOnServer = true;
    initialEquipeProfissional = await getConnectedEquipeProfissional(
      session.googleSub ?? '',
      session.user.email.toLowerCase().trim(),
    );
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#eafde7] flex items-center justify-center">
          Carregando...
        </div>
      }
    >
      <OnboardingPageClient
        initialEquipeProfissional={initialEquipeProfissional}
        equipeCheckedOnServer={equipeCheckedOnServer}
      />
    </Suspense>
  );
}
