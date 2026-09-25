'use client';

import { useMemo } from 'react';
import { Lock, Pencil, Plus, X } from 'lucide-react';
import type { MensagemTipo } from '@/lib/mensagensWhatsapp';
import { renderMensagem, type MensagemVars } from '@/lib/mensagensWhatsapp';
import {
  parseTemplate,
  serializeTemplate,
  PLACEHOLDER_LABELS,
  REQUIRED_BY_TIPO,
  INSERTABLE_BY_TIPO,
  ensureRequiredPlaceholders,
  PREVIEW_SAMPLE_VARS,
  type TemplatePart,
} from '@/lib/mensagemTemplate';
import WhatsAppPreviewBubble from '@/components/WhatsAppPreviewBubble';

const INSERT_LINE_PREFIX: Record<string, string> = {
  '{{link_curto}}': '📅 Agende seu horário: ',
  '{{link_cadastro}}': '📝 Faça seu cadastro: ',
  '{{link_catalogo}}': '💅 Serviços e preços: ',
  '{{link_site}}': '🌐 Nosso site: ',
  '{{local}}': '📍 ',
  '{{link_maps_curto}}': '🗺 Como chegar: ',
  '{{sessoes_datas}}': 'Sessões realizadas:\n',
  '{{pacote_nome}}': 'Pacote: ',
  '{{data}}': 'Data: ',
};

type Props = {
  tipo: MensagemTipo;
  value: string;
  onChange: (value: string) => void;
  /** Link para abrir modo “ver mensagem final” no pai */
  onVerCompleta?: () => void;
  previewVars?: MensagemVars;
};

export default function MensagemTemplateEditor({
  tipo,
  value,
  onChange,
  onVerCompleta,
  previewVars = PREVIEW_SAMPLE_VARS,
}: Props) {
  const parts = useMemo(() => parseTemplate(value), [value]);
  const required = REQUIRED_BY_TIPO[tipo];
  const insertable = INSERTABLE_BY_TIPO[tipo] ?? [];
  const faltando = insertable.filter((t) => !value.includes(t));

  function removeToken(index: number) {
    const MARK = '\u0000';
    const marked = serializeTemplate(
      parts.map((p, i) => (i === index ? { type: 'text' as const, value: MARK } : p)),
    );
    const lines = marked.split('\n');
    const li = lines.findIndex((l) => l.includes(MARK));
    if (li < 0) return;
    const semMarca = lines[li].replace(MARK, '');
    if (/\{\{\w+\}\}/.test(semMarca)) {
      lines[li] = semMarca;
    } else {
      lines.splice(li, 1);
    }
    onChange(lines.join('\n'));
  }

  function insertToken(token: string) {
    const base = value.replace(/\s+$/, '');
    onChange(`${base}\n${INSERT_LINE_PREFIX[token] ?? ''}${token}`);
  }

  const previewText = useMemo(() => {
    const tpl = ensureRequiredPlaceholders(value, tipo);
    return renderMensagem(tpl, previewVars, tipo);
  }, [value, tipo, previewVars]);

  function updatePart(index: number, text: string) {
    const next: TemplatePart[] = parts.map((p, i) =>
      i === index && p.type === 'text' ? { type: 'text', value: text } : p,
    );
    onChange(serializeTemplate(next));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <Pencil className="w-3.5 h-3.5 text-[#047482]" />
        <span className="font-medium">Personalizar texto</span>
        <span className="text-gray-400">— edite só as caixas brancas abaixo</span>
      </div>

      <WhatsAppPreviewBubble
        label="Prévia ao vivo (atualiza enquanto você digita)"
        text={previewText}
      />

      <div className="rounded-xl border border-gray-200 bg-[#fafafa] p-3 space-y-3">
        <p className="text-xs text-gray-500 flex items-start gap-1.5">
          <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#047482]" />
          {insertable.length > 0
            ? 'Blocos verdes = preenchidos automaticamente. Use “Tirar” para remover um link (a linha inteira sai) e os botões abaixo para colocar de volta.'
            : 'Blocos verdes = preenchidos automaticamente (nome, data, links…). Não dá para apagar — só o texto ao redor.'}
        </p>
        <div className="space-y-2">
          {parts.map((part, index) =>
            part.type === 'token' ? (
              <div
                key={`t-${index}-${part.token}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#047482] text-white text-xs font-semibold"
              >
                <Lock className="w-3.5 h-3.5 opacity-80 shrink-0" />
                <span>{PLACEHOLDER_LABELS[part.token] ?? part.token}</span>
                {insertable.includes(part.token) && !required.includes(part.token) ? (
                  <button
                    type="button"
                    onClick={() => removeToken(index)}
                    className="ml-auto inline-flex items-center gap-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium hover:bg-white/30"
                    aria-label={`Remover ${PLACEHOLDER_LABELS[part.token] ?? part.token}`}
                  >
                    <X className="w-3 h-3" />
                    Tirar
                  </button>
                ) : (
                  <span className="ml-auto text-[10px] font-normal opacity-80">Automático</span>
                )}
              </div>
            ) : (
              <textarea
                key={`x-${index}`}
                value={part.value}
                onChange={(e) => updatePart(index, e.target.value)}
                rows={Math.max(2, part.value.split('\n').length)}
                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed resize-y min-h-[2.5rem] focus:ring-2 focus:ring-[#3795a1] focus:border-[#047482]"
                placeholder="Digite o texto da mensagem..."
              />
            ),
          )}
        </div>
      </div>

      {faltando.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-600">Inserir no fim da mensagem:</p>
          <div className="flex flex-wrap gap-1.5">
            {faltando.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => insertToken(t)}
                className="inline-flex items-center gap-1 rounded-full border border-[#047482]/40 bg-white px-2.5 py-1 text-xs font-medium text-[#047482] hover:bg-[#D9F0F2]/50"
              >
                <Plus className="w-3 h-3" />
                {PLACEHOLDER_LABELS[t] ?? t}
              </button>
            ))}
          </div>
        </div>
      )}

      {required.length > 0 && (
        <p className="text-[11px] text-gray-400">
          Campos obrigatórios neste modelo:{' '}
          {required.map((t) => PLACEHOLDER_LABELS[t] ?? t).join(' · ')}
        </p>
      )}

      {onVerCompleta && (
        <button
          type="button"
          onClick={onVerCompleta}
          className="text-xs font-semibold text-[#047482] hover:underline"
        >
          Ver mensagem final em tela cheia →
        </button>
      )}
    </div>
  );
}
