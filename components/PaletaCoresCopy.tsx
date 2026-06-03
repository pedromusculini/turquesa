'use client';

import { useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyHexButton({ hex }: { hex: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* seleção manual */
    }
  }, [hex]);

  return (
    <button
      type="button"
      onClick={copy}
      className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-mono font-semibold text-gray-800 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
      aria-label={`Copiar ${hex}`}
    >
      {hex}
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5 text-gray-400" aria-hidden />
      )}
    </button>
  );
}
