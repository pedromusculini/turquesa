'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Puzzle } from 'lucide-react';

const STORAGE_KEY = 'medsupapp-chrome-ext-hint-dismissed-v1';

type ChromeExtensionNoticeProps = {
  /** compacto: uma linha; full: lista de extensões */
  variant?: 'compact' | 'full';
  className?: string;
};

export default function ChromeExtensionNotice({
  variant = 'full',
  className = '',
}: ChromeExtensionNoticeProps) {
  const [dismissed, setDismissed] = useState(true);
  const [expanded, setExpanded] = useState(variant === 'full');

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  if (dismissed && variant === 'full') return null;

  const isChrome =
    typeof navigator !== 'undefined' &&
    /Chrome/i.test(navigator.userAgent) &&
    !/Edg/i.test(navigator.userAgent);

  if (variant === 'compact' && !isChrome) return null;

  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50 text-amber-950 text-sm ${className}`}
      role="note"
      aria-label="Aviso sobre extensões do navegador"
    >
      <div className="flex items-start gap-2 p-3">
        <Puzzle className="w-5 h-5 shrink-0 text-amber-700 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-amber-900">
            {isChrome ? 'Usa Chrome no Windows?' : 'Problemas com botões ou cadastro?'}
          </p>
          <p className="mt-1 text-xs text-amber-900/90 leading-relaxed">
            Extensões podem bloquear cliques, login Google ou o envio do formulário. Teste em{' '}
            <strong>janela anônima</strong> (Ctrl+Shift+N) ou desative extensões para este site.
          </p>
          {variant === 'full' && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-xs font-semibold text-amber-800 hover:underline flex items-center gap-1"
            >
              {expanded ? (
                <>
                  Ocultar lista <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  Ver extensões que mais atrapalham <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}
        </div>
        {variant === 'full' && (
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-amber-800 hover:underline shrink-0"
          >
            Fechar
          </button>
        )}
      </div>

      {variant === 'full' && expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-amber-200/80">
          <ul className="text-xs space-y-1.5 list-disc pl-5 text-amber-900/95">
            <li>Bloqueadores de anúncio (uBlock Origin, AdBlock, AdGuard)</li>
            <li>Privacidade (Privacy Badger, Ghostery, DuckDuckGo)</li>
            <li>Autopreenchimento de senha (LastPass, Bitwarden, 1Password) em páginas de login</li>
            <li>Grammarly, tradutores automáticos e “Dark mode” forçado</li>
            <li>Cupons / cashback (Honey e similares) que injetam scripts na página</li>
            <li>VPN ou proxy no navegador alterando cookies do Google</li>
          </ul>
          <p className="mt-3 text-xs flex items-start gap-1.5 text-amber-900">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Em <code className="bg-white/80 px-1 rounded">chrome://extensions</code>, desligue
              uma a uma ou use “Permitir neste site” se a extensão oferecer. Depois recarregue a
              página (F5).
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
