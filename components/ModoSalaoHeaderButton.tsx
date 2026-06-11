'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import ModoSalaoPinModal from '@/components/ModoSalaoPinModal';

type Status = {
  enabled: boolean;
  hasPin: boolean;
  locked: boolean;
  unlocked: boolean;
};

export default function ModoSalaoHeaderButton() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [acting, setActing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/financeiro/unlock', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  if (loading || !status?.enabled || !status.hasPin) return null;

  async function handleLock() {
    setActing(true);
    try {
      await fetch('/api/financeiro/unlock', { method: 'DELETE' });
      await refresh();
    } finally {
      setActing(false);
    }
  }

  if (status.unlocked) {
    return (
      <button
        type="button"
        onClick={handleLock}
        disabled={acting}
        className="hidden items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 transition hover:bg-amber-100 md:inline-flex"
        title="Bloquear financeiro e backup"
      >
        {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        Bloquear financeiro
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="hidden items-center gap-1.5 rounded-lg border border-[#047482]/20 bg-[#047482]/5 px-3 py-1.5 text-sm font-medium text-[#047482] transition hover:bg-[#047482]/10 md:inline-flex"
        title="Desbloquear financeiro com PIN"
      >
        <ShieldCheck className="h-4 w-4" />
        Ativar modo salão
      </button>
      <ModoSalaoPinModal
        open={modalOpen}
        locked={status.locked}
        title="Desbloquear modo salão"
        onUnlocked={() => {
          setModalOpen(false);
          refresh();
        }}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
