'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Check, CheckCircle2, MessageCircle, X } from 'lucide-react';
import { usePrimeirosPassosTour } from '@/lib/PrimeirosPassosTourContext';
import { fetchAtivacao, type AtivacaoResponse } from '@/lib/ativacaoClient';

type Passo = {
  id: string;
  titulo: string;
  descricao: string;
  feito: boolean;
  href: string;
  externo?: boolean;
  Icon: typeof Calendar;
  extra?: { label: string; href: string };
};

/** Checklist de ativação: some sozinho quando os 3 marcos estiverem feitos. */
export default function ComecePorAquiCard() {
  const { isHintDismissed, dismissHint, tourActive } = usePrimeirosPassosTour();
  const [linkAgendar, setLinkAgendar] = useState<string | null>(null);
  const [msgWhatsapp, setMsgWhatsapp] = useState<string | null>(null);
  const [ativacao, setAtivacao] = useState<AtivacaoResponse | null>(null);

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
    void fetchAtivacao().then((data) => {
      if (!cancelled) setAtivacao(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (tourActive || isHintDismissed('hint-comece-por-aqui')) return null;

  const resumo = ativacao?.resumo;
  const whatsappHref = msgWhatsapp
    ? `https://wa.me/?text=${encodeURIComponent(msgWhatsapp)}`
    : null;

  const passos: Passo[] = [
    {
      id: 'sessao',
      titulo: 'Crie a primeira sessão',
      descricao: 'Toque num horário da agenda e coloque uma cliente de verdade.',
      feito: (resumo?.sessoes ?? 0) > 0,
      href: '/agenda',
      Icon: Calendar,
    },
    {
      id: 'link',
      titulo: 'Receba um agendamento pelo link',
      descricao: 'Mande o link no WhatsApp — a cliente marca sozinha.',
      feito: (resumo?.agendamentosPeloLink ?? 0) > 0,
      href: whatsappHref ?? '/dashboard/configuracoes?tab=link',
      externo: Boolean(whatsappHref),
      Icon: MessageCircle,
      extra: linkAgendar ? { label: 'Testar como cliente', href: linkAgendar } : undefined,
    },
    {
      id: 'finalizar',
      titulo: 'Finalize um atendimento',
      descricao: 'Registra o pagamento e calcula o repasse da equipe na hora.',
      feito: (resumo?.finalizadas ?? 0) > 0,
      href: '/agenda',
      Icon: CheckCircle2,
    },
  ];

  const feitos = passos.filter((p) => p.feito).length;
  if (resumo && feitos === passos.length) return null;

  return (
    <div className="mb-5 rounded-2xl border border-[#047482]/20 bg-[#eef4f5] p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#047482]">
            Primeiros passos · {feitos} de {passos.length}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-[#047482] transition-all"
              style={{ width: `${(feitos / passos.length) * 100}%` }}
            />
          </div>
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
        {passos.map((p, idx) => {
          const conteudo = (
            <>
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  p.feito ? 'bg-emerald-500 text-white' : 'bg-[#047482] text-white'
                }`}
              >
                {p.feito ? <Check className="h-4 w-4" aria-hidden /> : idx + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`flex items-center gap-1.5 text-sm font-semibold ${
                    p.feito ? 'text-slate-400 line-through' : 'text-slate-900'
                  }`}
                >
                  <p.Icon className="h-4 w-4 text-[#047482]" aria-hidden />
                  {p.titulo}
                </span>
                {!p.feito && (
                  <span className="mt-0.5 block text-xs text-slate-500">{p.descricao}</span>
                )}
              </span>
            </>
          );
          const className =
            'flex items-start gap-3 rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-black/5';
          return (
            <li key={p.id}>
              {p.externo ? (
                <a href={p.href} target="_blank" rel="noopener noreferrer" className={className}>
                  {conteudo}
                </a>
              ) : (
                <Link href={p.href} className={className}>
                  {conteudo}
                </Link>
              )}
              {p.extra && !p.feito && (
                <a
                  href={p.extra.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-12 mt-1 inline-block text-xs font-semibold text-[#047482] underline"
                >
                  {p.extra.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
