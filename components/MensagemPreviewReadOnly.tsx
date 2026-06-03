'use client';

import { useMemo } from 'react';
import { Eye, Lock } from 'lucide-react';
import type { MensagemTipo } from '@/lib/mensagensWhatsapp';
import { renderMensagem } from '@/lib/mensagensWhatsapp';
import {
  ensureRequiredPlaceholders,
  MENSAGEM_TIPO_INFO,
  PREVIEW_SAMPLE_VARS,
} from '@/lib/mensagemTemplate';
import WhatsAppPreviewBubble from '@/components/WhatsAppPreviewBubble';

type Props = {
  tipo: MensagemTipo;
  template: string;
  className?: string;
};

/** Visualização somente leitura da mensagem final (como o paciente verá). */
export default function MensagemPreviewReadOnly({
  tipo,
  template,
  className = '',
}: Props) {
  const mensagemFinal = useMemo(() => {
    const tpl = ensureRequiredPlaceholders(template, tipo);
    return renderMensagem(tpl, PREVIEW_SAMPLE_VARS);
  }, [template, tipo]);

  const info = MENSAGEM_TIPO_INFO[tipo];

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
          <Eye className="w-3.5 h-3.5" />
          Somente leitura
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
          <Lock className="w-3 h-3" />
          Não é possível editar aqui
        </span>
      </div>
      <p className="text-xs text-gray-500">{info.quando}</p>
      <WhatsAppPreviewBubble
        label="Mensagem final (exemplo: Maria Silva, 15/06/2026 às 14:30)"
        text={mensagemFinal}
      />
      <p className="text-[11px] text-gray-400">
        Nome, data, horário e links serão trocados automaticamente pelos dados reais de cada
        paciente.
      </p>
    </div>
  );
}
