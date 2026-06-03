'use client';

import { Suspense } from 'react';
import AgendarPublicoClient from '@/components/AgendarPublicoClient';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function AgendarInner() {
  const params = useParams();
  const slug = params.slug as string;
  return <AgendarPublicoClient slug={slug} />;
}

export default function AgendarPublicoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#228B22]" />
        </div>
      }
    >
      <AgendarInner />
    </Suspense>
  );
}
