'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

function safeCallbackUrl(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/onboarding';
  return raw;
}

/** OTP pós-Google foi removido: esta rota só redireciona (links antigos / bookmarks). */
export default function VerificarEmailGoogleClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const callbackUrl = safeCallbackUrl(searchParams.get('callbackUrl'));

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (status === 'authenticated') {
      window.location.replace(callbackUrl);
    }
  }, [status, callbackUrl, router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-[#047482]" />
        <p className="text-sm text-slate-600">Entrando…</p>
      </div>
    </div>
  );
}
