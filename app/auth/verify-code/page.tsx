'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Rota legada — redireciona para o fluxo atual com Google + OTP de 6 dígitos */
function VerifyCodeRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const role = searchParams.get('role');
    const plan = searchParams.get('plan');
    const trial = searchParams.get('trialStarted');
    const params = new URLSearchParams();
    let cb = '/onboarding';
    if (role || plan || trial) {
      const onboarding = new URLSearchParams();
      if (role) onboarding.set('role', role);
      if (plan) onboarding.set('plan', plan);
      if (trial) onboarding.set('trialStarted', trial);
      cb = `/onboarding?${onboarding.toString()}`;
    }
    params.set('callbackUrl', cb);
    router.replace(`/auth/verificar-email?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <Loader2 className="h-8 w-8 animate-spin text-green-600" aria-label="Redirecionando" />
    </div>
  );
}

export default function VerifyCodePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      }
    >
      <VerifyCodeRedirect />
    </Suspense>
  );
}
