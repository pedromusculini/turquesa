'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import ModoSalaoPinModal from '@/components/ModoSalaoPinModal';

type Props = {
  children: React.ReactNode;
  areaLabel?: string;
};

type Status = {
  enabled: boolean;
  hasPin: boolean;
  locked: boolean;
  unlocked: boolean;
};

export default function ModoSalaoPinGate({ children, areaLabel = 'esta área' }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/financeiro/unlock', { cache: 'no-store' });
      if (!res.ok) {
        setStatus(null);
        return;
      }
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
  }, [refresh]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#047482]" />
      </div>
    );
  }

  const protectedArea = status?.enabled && status?.hasPin;
  const needsPin = protectedArea && !status.unlocked;

  if (!needsPin) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
        <p className="max-w-md text-gray-600">
          O modo salão está ativo. Informe o PIN para acessar {areaLabel}.
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Use o botão &quot;Ativar modo salão&quot; no topo ou desbloqueie abaixo.
        </p>
      </div>
      <ModoSalaoPinModal
        open
        locked={status.locked}
        title={`PIN — ${areaLabel}`}
        onUnlocked={refresh}
      />
    </>
  );
}
