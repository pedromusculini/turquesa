'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { LayoutDashboard } from 'lucide-react';
import LandingPageContent from '@/components/LandingPageContent';

/** Landing pública em / — sem redirecionar para login/dashboard. */
export default function Home() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated' && !!session?.user;
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setEmailVerified(false);
      return;
    }
    fetch('/api/auth/google-access/status')
      .then((r) => r.json())
      .then((data) => setEmailVerified(data.accessVerified === true))
      .catch(() => setEmailVerified(false));
  }, [isAuthenticated]);

  return (
    <>
      {isAuthenticated && (
        <div className="bg-[#f4fff4] border-b border-[#90EE90]/40 px-6 py-3">
          <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <p className="text-[#2d652d]">
              Você está conectado como <strong>{session.user?.email}</strong>
            </p>
            {emailVerified ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-[#013a01] px-4 py-2 font-semibold text-white hover:bg-[#025201] transition"
              >
                <LayoutDashboard className="w-4 h-4" />
                Abrir painel
              </Link>
            ) : (
              <Link
                href="/auth/verificar-email"
                className="inline-flex items-center gap-2 rounded-xl border border-[#228B22] px-4 py-2 font-semibold text-[#013a01] hover:bg-white transition"
              >
                Confirmar e-mail
              </Link>
            )}
          </div>
        </div>
      )}
      <LandingPageContent />
    </>
  );
}
