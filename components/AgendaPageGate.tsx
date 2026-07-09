'use client';

import type { ReactNode } from 'react';
import type { ProfissionalOption } from '@/lib/loadMedicosOptions';
import { useGoogleConnectionHealth } from '@/lib/useGoogleConnectionHealth';
import AgendaPrerequisitesGate from '@/components/AgendaPrerequisitesGate';

type Props = {
  children: ReactNode;
  userEmail: string;
  medicosLoading: boolean;
  profissionais: ProfissionalOption[];
  isClinica: boolean;
};

/** Bloqueia a agenda até Google (Drive+Calendar) e equipe estarem prontos. */
export default function AgendaPageGate({
  children,
  userEmail,
  medicosLoading,
  profissionais,
  isClinica,
}: Props) {
  const { data: google, loading: googleLoading } = useGoogleConnectionHealth();

  const loading = medicosLoading || googleLoading;
  const needsProfissional = profissionais.length === 0;
  const googleBlocked =
    !googleLoading &&
    !!google &&
    (google.needsConnect ||
      google.needsReconnect ||
      google.healthy === false ||
      google.driveHealthy === false ||
      google.calendarHealthy === false);

  const blocked = !loading && (needsProfissional || googleBlocked);

  if (loading || blocked) {
    return (
      <AgendaPrerequisitesGate
        userEmail={userEmail}
        medicosLoading={loading}
        profissionais={profissionais}
        isClinica={isClinica}
        google={google}
        googleLoading={googleLoading}
        blocked={blocked}
      />
    );
  }

  return <>{children}</>;
}
