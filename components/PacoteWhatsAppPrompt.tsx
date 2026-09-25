'use client';

import { Copy, MessageCircle, X } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import WhatsAppPreviewBubble from '@/components/WhatsAppPreviewBubble';
import { openWhatsAppUrl } from '@/lib/openExternalUrl';
import type { WhatsAppUrls } from '@/lib/whatsapp';

export type PacoteWhatsAppData = {
  mensagem: string;
  whatsapp: WhatsAppUrls | null;
};

type Props = {
  data: PacoteWhatsAppData | null;
  resumo?: string | null;
  onClose: () => void;
};

/**
 * Aparece depois de finalizar uma sessão de pacote. O envio é por clique
 * (não abre sozinho) para o navegador não bloquear o WhatsApp como pop-up.
 */
export default function PacoteWhatsAppPrompt({ data, resumo, onClose }: Props) {
  const toast = useToast();
  if (!data) return null;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(data!.mensagem);
      toast.success('Mensagem copiada');
    } catch {
      toast.error('Não foi possível copiar');
    }
  }

  function enviar() {
    if (!data?.whatsapp) return;
    openWhatsAppUrl(data.whatsapp.web, {
      appUrl: data.whatsapp.app,
      androidUrl: data.whatsapp.android,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Enviar controle de sessões"
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-900">Sessão do pacote registrada</h2>
            {resumo && <p className="text-xs text-gray-500 mt-0.5">{resumo}</p>}
            <p className="text-sm text-gray-600 mt-2">
              Envie o controle de sessões para a cliente pelo WhatsApp:
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <WhatsAppPreviewBubble label="Mensagem" text={data.mensagem} />

        <div className="flex flex-col sm:flex-row gap-2">
          {data.whatsapp ? (
            <button
              type="button"
              onClick={enviar}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#25D366] text-white font-semibold text-sm"
            >
              <MessageCircle className="w-4 h-4" />
              Enviar no WhatsApp
            </button>
          ) : (
            <p className="flex-1 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
              Cliente sem telefone cadastrado — copie a mensagem e envie manualmente.
            </p>
          )}
          <button
            type="button"
            onClick={copiar}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#047482] text-[#047482] font-semibold text-sm"
          >
            <Copy className="w-4 h-4" />
            Copiar
          </button>
        </div>
        <p className="text-[11px] text-gray-400">
          Personalize este texto em Configurações → Mensagens → Controle de sessões do pacote.
        </p>
      </div>
    </div>
  );
}
