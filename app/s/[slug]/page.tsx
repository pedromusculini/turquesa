'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import SalaoLandingView from '@/components/SalaoLandingView';
import type { LandingPublicData } from '@/lib/salonLanding';

export default function SalaoPublicPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<LandingPublicData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/public/salao?slug=${encodeURIComponent(slug)}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || 'Página não encontrada');
          return;
        }
        setData(json as LandingPublicData);
      } catch {
        if (!cancelled) setError('Não foi possível abrir o site do salão.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!data && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#047482]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-center text-sm text-gray-600">{error || 'Página não encontrada'}</p>
      </div>
    );
  }

  return <SalaoLandingView data={data} />;
}
