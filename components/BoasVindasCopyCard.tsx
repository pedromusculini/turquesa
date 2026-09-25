'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, ChevronUp, Copy, Heart, Loader2, MessageCircle } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import WhatsAppPreviewBubble from '@/components/WhatsAppPreviewBubble';
import { openWhatsAppUrl } from '@/lib/openExternalUrl';
import { buildWhatsAppUrls } from '@/lib/whatsapp';

type Props = {
  /** Texto em edição (Configurações). Sem ele, usa o modelo salvo. */
  template?: string;
  variant?: 'card' | 'inline';
};

/**
 * Mensagem de boas-vindas pronta, com os links reais do salão, para copiar e colar
 * quando uma cliente nova chama no WhatsApp. Renderizada no servidor (links curtos reais).
 */
export default function BoasVindasCopyCard({ template, variant = 'card' }: Props) {
  const toast = useToast();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [aberto, setAberto] = useState(variant === 'inline');

  useEffect(() => {
    let cancel = false;
    const t = setTimeout(
      async () => {
        setLoading(true);
        try {
          const res = await fetch('/api/comunicacao/boas-vindas', {
            method: template === undefined ? 'GET' : 'POST',
            headers: template === undefined ? undefined : { 'Content-Type': 'application/json' },
            body: template === undefined ? undefined : JSON.stringify({ template }),
          });
          const data = (await res.json().catch(() => ({}))) as { mensagem?: string };
          if (!cancel) setMensagem(res.ok ? (data.mensagem ?? '') : null);
        } catch {
          if (!cancel) setMensagem(null);
        } finally {
          if (!cancel) setLoading(false);
        }
      },
      template === undefined ? 0 : 600,
    );
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [template]);

  async function copiar() {
    if (!mensagem) return;
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      toast.success('Mensagem de boas-vindas copiada. É só colar no WhatsApp!');
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('Não foi possível copiar');
    }
  }

  function abrirWhatsApp() {
    if (!mensagem) return;
    const urls = buildWhatsAppUrls(null, mensagem);
    openWhatsAppUrl(urls.web, { appUrl: urls.app, androidUrl: urls.android });
  }

  const acoes = (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void copiar()}
        disabled={!mensagem || loading}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#047482] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : copiado ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        Copiar mensagem
      </button>
      <button
        type="button"
        onClick={abrirWhatsApp}
        disabled={!mensagem || loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#25D366] px-3 py-2 text-xs font-semibold text-[#128C7E] disabled:opacity-50"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        Escolher contato no WhatsApp
      </button>
    </div>
  );

  if (variant === 'inline') {
    return (
      <div className="space-y-3 rounded-xl border border-[#3795a1]/40 bg-[#eef4f5] p-3">
        <p className="text-xs font-semibold text-[#047482]">
          Mensagem final com seus links reais (para copiar e colar)
        </p>
        {mensagem !== null && <WhatsAppPreviewBubble text={mensagem} />}
        {acoes}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Heart className="mt-0.5 h-5 w-5 shrink-0 text-[#047482]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Boas-vindas para cliente nova</p>
          <p className="text-xs text-gray-500">
            Cliente nova chamou no WhatsApp? Copie e cole: agendamento, cadastro, catálogo e site
            numa mensagem só.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="p-1 text-gray-400"
          aria-label={aberto ? 'Ocultar prévia' : 'Ver prévia'}
        >
          {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {aberto && mensagem !== null && <WhatsAppPreviewBubble className="mt-3" text={mensagem} />}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {acoes}
        <Link
          href="/dashboard/configuracoes?tab=mensagens&msg=boas_vindas"
          className="text-xs font-medium text-[#047482] hover:underline"
        >
          Personalizar texto e links
        </Link>
      </div>
    </div>
  );
}
