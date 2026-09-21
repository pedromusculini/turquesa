'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Calendar, MessageCircle, X } from 'lucide-react';
import { usePrimeirosPassosTour } from '@/lib/PrimeirosPassosTourContext';

/** Próximos passos depois que o onboarding já deixou o salão no ar. */
export default function ComecePorAquiCard() {
  const { isHintDismissed, dismissHint, tourActive } = usePrimeirosPassosTour();
  const [linkAgendar, setLinkAgendar] = useState<string | null>(null);
  const [msgWhatsapp, setMsgWhatsapp] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/formulario/autocadastro', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (typeof json.link_agendar === 'string' && json.link_agendar) {
          setLinkAgendar(json.link_agendar);
        }
        if (typeof json.mensagem_whatsapp_agendar === 'string') {
          setMsgWhatsapp(json.mensagem_whatsapp_agendar);
        }
      })
      .catch(() => {
        /* painel ainda funciona sem o card de envio */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (tourActive || isHintDismissed('hint-comece-por-aqui')) return null;

  const whatsappHref = msgWhatsapp
    ? `https://wa.me/?text=${encodeURIComponent(msgWhatsapp)}`
    : null;

  return (
    <div className="mb-5 rounded-2xl border border-[#047482]/20 bg-[#eef4f5] p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#047482]">
            Primeiro uso
          </p>
          <p className="mt-1 text-sm text-slate-600">
            O salão já está no ar. Agora é só usar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void dismissHint('hint-comece-por-aqui')}
          className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-white/80 hover:text-gray-600"
          aria-label="Dispensar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ol className="space-y-2">
        <li>
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-black/5"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#047482] text-xs font-bold text-white">
                1
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <MessageCircle className="h-4 w-4 text-[#047482]" aria-hidden />
                  Mande o link no WhatsApp
                </span>
                <span className="mt-0.5 hidden text-xs text-slate-500 sm:block">
                  A cliente marca sozinha. Sem “tem horário?”.
                </span>
              </span>
            </a>
          ) : (
            <Link
              href="/dashboard/configuracoes?tab=link"
              className="flex items-start gap-3 rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-black/5"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#047482] text-xs font-bold text-white">
                1
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <MessageCircle className="h-4 w-4 text-[#047482]" aria-hidden />
                  Gere o link de autoagendamento
                </span>
              </span>
            </Link>
          )}
        </li>
        <li>
          <a
            href={linkAgendar || '/agenda'}
            target={linkAgendar ? '_blank' : undefined}
            rel={linkAgendar ? 'noopener noreferrer' : undefined}
            className="flex items-start gap-3 rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-black/5"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#047482] text-xs font-bold text-white">
              2
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Calendar className="h-4 w-4 text-[#047482]" aria-hidden />
                Teste como cliente
              </span>
              <span className="mt-0.5 hidden text-xs text-slate-500 sm:block">
                Abre o mesmo link que ela recebe e marca um horário.
              </span>
            </span>
          </a>
        </li>
        <li>
          <Link
            href="/dashboard/catalogo"
            className="flex items-start gap-3 rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-black/5"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#047482] text-xs font-bold text-white">
              3
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <BookOpen className="h-4 w-4 text-[#047482]" aria-hidden />
                Ajuste preço e tempo
              </span>
              <span className="mt-0.5 hidden text-xs text-slate-500 sm:block">
                Os serviços já existem. Mude valores quando quiser.
              </span>
            </span>
          </Link>
        </li>
      </ol>
    </div>
  );
}
