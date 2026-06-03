'use client';

type WhatsAppPreviewBubbleProps = {
  text: string;
  /** Rótulo acima do balão (ex.: "Prévia com dados de exemplo") */
  label?: string;
  className?: string;
};

/** Balão estilo WhatsApp para pré-visualização de mensagens */
export default function WhatsAppPreviewBubble({
  text,
  label,
  className = '',
}: WhatsAppPreviewBubbleProps) {
  return (
    <div className={`rounded-xl bg-[#e5ddd5] p-4 ${className}`}>
      {label && (
        <p className="text-xs font-medium text-gray-600 mb-2">{label}</p>
      )}
      <div className="flex justify-start">
        <div className="max-w-[95%] bg-white rounded-lg rounded-tl-sm px-3 py-2.5 shadow-sm border border-black/5">
          <p className="text-sm text-gray-900 whitespace-pre-wrap break-words leading-relaxed">
            {text || '(mensagem vazia)'}
          </p>
          <p className="text-[10px] text-gray-400 text-right mt-1.5">12:34</p>
        </div>
      </div>
    </div>
  );
}
