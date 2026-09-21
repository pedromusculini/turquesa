'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { LayoutDashboard } from 'lucide-react';
import LandingPageContent from '@/components/LandingPageContent';

/** Landing pública em / — sem redirecionar para login/dashboard. */
export default function HomeClient() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  return (
    <>
      {isAuthenticated && (
        <div className="bg-[#eef4f5] border-b border-[#3795a1]/40 px-6 py-3">
          <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <p className="text-[#047482]">
              Você está conectado como <strong>{session.user?.email}</strong>
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-[#047482] px-4 py-2 font-semibold text-white hover:bg-[#035e6b] transition"
            >
              <LayoutDashboard className="w-4 h-4" />
              Abrir painel
            </Link>
          </div>
        </div>
      )}
      <LandingPageContent />
    </>
  );
}
