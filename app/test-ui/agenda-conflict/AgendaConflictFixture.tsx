'use client';

import { useState } from 'react';
import AgendaTimeConflictModal from '@/components/AgendaTimeConflictModal';
import type { ConsultationRecord } from '@/lib/consultations';

const MOCK: ConsultationRecord = {
  id: 'conflict-1',
  patient: 'Ana Silva',
  start: '2026-09-04T17:00:00.000Z',
  end: '2026-09-04T17:30:00.000Z',
  syncHealth: 'needs_review',
  conflictGoogleInicio: '2026-09-05T18:00:00.000Z',
  conflictGoogleFim: '2026-09-05T18:30:00.000Z',
};

export default function AgendaConflictFixture() {
  const [open, setOpen] = useState(true);
  const [choice, setChoice] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <p data-testid="conflict-status">
        {open ? 'modal-open' : choice ? `chose-${choice}` : 'dismissed'}
      </p>
      {!open ? (
        <button
          type="button"
          data-testid="reopen-conflict"
          className="mt-4 rounded-lg bg-[#047482] px-4 py-2 text-white"
          onClick={() => {
            setOpen(true);
            setChoice(null);
          }}
        >
          Reabrir
        </button>
      ) : null}
      {open ? (
        <AgendaTimeConflictModal
          event={MOCK}
          resolving={resolving}
          onDismiss={() => {
            setOpen(false);
            setChoice(null);
          }}
          onResolve={async (keep) => {
            setResolving(true);
            await new Promise((r) => setTimeout(r, 30));
            setResolving(false);
            setChoice(keep);
            setOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}
