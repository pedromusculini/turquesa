'use client';

import { useState } from 'react';
import { Copy, Smartphone } from 'lucide-react';
import { PWA_INSTALL_URL } from '@/lib/constants';

export default function InstallAppLinkCard() {
  const [copied, setCopied] = useState(false);

  async function copiar() {
    await navigator.clipboard.writeText(PWA_INSTALL_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-[#047482]/20 bg-gradient-to-br from-[#eef4f5] via-white to-[#F8FAFC] p-5 shadow-sm mb-8">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#047482]/10">
          <Smartphone className="h-5 w-5 text-[#047482]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-gray-900">Link para instalar o app</h3>
          <p className="mt-1 text-sm text-gray-600 leading-relaxed">
            Envie para você ou para a equipe do salão. Abre a página de instalação no celular ou no
            computador — sem precisar entrar no Dashboard.
          </p>
          <p className="mt-3 font-mono text-sm break-all rounded-lg border border-gray-100 bg-white p-3 text-gray-800">
            {PWA_INSTALL_URL}
          </p>
          <button
            type="button"
            onClick={() => void copiar()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#047482]/30 px-3 py-2 text-sm font-medium text-[#047482] hover:bg-[#eef4f5]"
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Copiado!' : 'Copiar link'}
          </button>
        </div>
      </div>
    </div>
  );
}
