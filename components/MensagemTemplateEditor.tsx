'use client';

import { useMemo } from 'react';
import { Lock, Pencil } from 'lucide-react';
import type { MensagemTipo } from '@/lib/mensagensWhatsapp';
import { renderMensagem } from '@/lib/mensagensWhatsapp';
import {
  parseTemplate,
  serializeTemplate,
  PLACEHOLDER_LABELS,
  REQUIRED_BY_TIPO,
  ensureRequiredPlaceholders,
  PREVIEW_SAMPLE_VARS,
  type TemplatePart,
} from '@/lib/mensagemTemplate';
import WhatsAppPreviewBubble from '@/components/WhatsAppPreviewBubble';

type Props = {
  tipo: MensagemTipo;
  value: string;
  onChange: (value: string) => void;
  /** Link para abrir modo “ver mensagem final” no pai */
  onVerCompleta?: () => void;
};

export default function MensagemTemplateEditor({
  tipo,
  value,
  onChange,
  onVerCompleta,
}: Props) {
  const parts = useMemo(() => parseTemplate(value), [value]);
  const required = REQUIRED_BY_TIPO[tipo];

  const previewText = useMemo(() => {
    const tpl = ensureRequiredPlaceholders(value, tipo);
    return renderMensagem(tpl, PREVIEW_SAMPLE_VARS);
  }, [value, tipo]);

  function updatePart(index: number, text: string) {
    const next: TemplatePart[] = parts.map((p, i) =>
      i === index && p.type === 'text' ? { type: 'text', value: text } : p,
    );
    onChange(serializeTemplate(next));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <Pencil className="w-3.5 h-3.5 text-[#228B22]" />
        <span className="font-medium">Personalizar texto</span>
        <span className="text-gray-400">— edite só as caixas brancas abaixo</span>
      </div>

      <WhatsAppPreviewBubble
        label="Prévia ao vivo (atualiza enquanto você digita)"
        text={previewText}
      />

      <div className="rounded-xl border border-gray-200 bg-[#fafafa] p-3 space-y-3">
        <p className="text-xs text-gray-500 flex items-start gap-1.5">
          <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#228B22]" />
          Blocos verdes = preenchidos automaticamente (nome, data, links…). Não dá para
          apagar — só o texto ao redor.
        </p>
        <div className="space-y-2">
          {parts.map((part, index) =>
            part.type === 'token' ? (
              <div
                key={`t-${index}-${part.token}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#013a01] text-white text-xs font-semibold"
              >
                <Lock className="w-3.5 h-3.5 opacity-80 shrink-0" />
                <span>{PLACEHOLDER_LABELS[part.token] ?? part.token}</span>
                <span className="ml-auto text-[10px] font-normal opacity-80">Automático</span>
              </div>
            ) : (
              <textarea
                key={`x-${index}`}
                value={part.value}
                onChange={(e) => updatePart(index, e.target.value)}
                rows={Math.max(2, part.value.split('\n').length)}
                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed resize-y min-h-[2.5rem] focus:ring-2 focus:ring-[#90EE90] focus:border-[#228B22]"
                placeholder="Digite o texto da mensagem..."
              />
            ),
          )}
        </div>
      </div>

      <p className="text-[11px] text-gray-400">
        Campos obrigatórios neste modelo:{' '}
        {required.map((t) => PLACEHOLDER_LABELS[t] ?? t).join(' · ')}
      </p>

      {onVerCompleta && (
        <button
          type="button"
          onClick={onVerCompleta}
          className="text-xs font-semibold text-[#228B22] hover:underline"
        >
          Ver mensagem final em tela cheia →
        </button>
      )}
    </div>
  );
}
