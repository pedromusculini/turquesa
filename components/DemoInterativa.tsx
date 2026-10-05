'use client';

/**
 * Demo pública sem login (/demo): agenda, autoagendamento e repasse com dados fictícios.
 * Nada é salvo — estado só em memória.
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarDays, Check, Link2, MessageCircle, Plus, Wallet, X } from 'lucide-react';
import BrandLogoIcon from '@/components/BrandLogoIcon';
import { formatCurrency } from '@/lib/constants';
import { BRAND } from '@/lib/visual/brand';
import { trackMetaCtaClick } from '@/lib/metaPixel';
import { trackGa4Event } from '@/lib/siteAnalytics';

const { colors: C, productName } = BRAND;
const P = C.primary;
const S = C.primaryHover;
const A = C.accent;

const CTA_HREF = '/login?callbackUrl=%2Fonboarding';

type Servico = { id: string; nome: string; preco: number; minutos: number };

const SERVICOS: Servico[] = [
  { id: 'corte', nome: 'Corte feminino', preco: 90, minutos: 60 },
  { id: 'escova', nome: 'Escova', preco: 60, minutos: 45 },
  { id: 'coloracao', nome: 'Coloração', preco: 180, minutos: 120 },
  { id: 'manicure', nome: 'Manicure', preco: 40, minutos: 45 },
  { id: 'design', nome: 'Design de sobrancelha', preco: 50, minutos: 30 },
];

const PROFISSIONAIS = [
  { nome: 'Rani', cor: '#047482' },
  { nome: 'Marri', cor: '#c69c6c' },
];

type FormaPagamento = 'pix' | 'debito' | 'credito';

const FORMAS: { id: FormaPagamento; label: string; taxaPercent: number }[] = [
  { id: 'pix', label: 'PIX', taxaPercent: 0 },
  { id: 'debito', label: 'Débito', taxaPercent: 1.99 },
  { id: 'credito', label: 'Crédito 1x', taxaPercent: 3.6 },
];

const COMISSAO_PERCENT = 50;

type Sessao = {
  id: string;
  horario: string;
  cliente: string;
  servicoId: string;
  profissional: string;
  origem: 'agenda' | 'link';
  finalizada?: { forma: FormaPagamento; bruto: number; taxa: number; profissional: number; salao: number };
};

const SESSOES_INICIAIS: Sessao[] = [
  { id: 's1', horario: '09:00', cliente: 'Ana Souza', servicoId: 'coloracao', profissional: 'Rani', origem: 'agenda' },
  { id: 's2', horario: '10:30', cliente: 'Letícia B.', servicoId: 'escova', profissional: 'Marri', origem: 'agenda' },
  { id: 's3', horario: '13:00', cliente: 'Camila Dias', servicoId: 'manicure', profissional: 'Marri', origem: 'agenda' },
  { id: 's4', horario: '15:00', cliente: 'Juliana M.', servicoId: 'corte', profissional: 'Rani', origem: 'agenda' },
];

const HORARIOS_LIVRES = ['11:30', '14:00', '16:30', '17:30'];

function servicoById(id: string): Servico {
  return SERVICOS.find((s) => s.id === id) ?? SERVICOS[0];
}

function calcularRepasse(bruto: number, forma: FormaPagamento) {
  const taxaPercent = FORMAS.find((f) => f.id === forma)?.taxaPercent ?? 0;
  const taxa = Math.round(bruto * taxaPercent) / 100;
  const liquido = bruto - taxa;
  const profissional = Math.round(liquido * COMISSAO_PERCENT) / 100;
  return { bruto, taxa, liquido, profissional, salao: liquido - profissional };
}

function trackDemo(acao: string): void {
  trackGa4Event('demo_interacao', { acao });
  if (typeof window !== 'undefined') window.clarity?.('event', `demo_${acao}`);
}

type Aba = 'agenda' | 'link' | 'financeiro';

export default function DemoInterativa() {
  const [aba, setAba] = useState<Aba>('agenda');
  const [sessoes, setSessoes] = useState<Sessao[]>(SESSOES_INICIAIS);
  const [finalizando, setFinalizando] = useState<Sessao | null>(null);
  const [forma, setForma] = useState<FormaPagamento>('pix');
  const [lembrete, setLembrete] = useState<Sessao | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [bookServico, setBookServico] = useState<string>('corte');
  const [bookHorario, setBookHorario] = useState<string | null>(null);
  const [bookNome, setBookNome] = useState('');

  const ordenadas = useMemo(
    () => [...sessoes].sort((a, b) => a.horario.localeCompare(b.horario)),
    [sessoes],
  );
  const ocupados = new Set(sessoes.map((s) => s.horario));
  const livres = HORARIOS_LIVRES.filter((h) => !ocupados.has(h));

  const finalizadas = sessoes.filter((s) => s.finalizada);
  const totais = finalizadas.reduce(
    (acc, s) => {
      const f = s.finalizada!;
      acc.bruto += f.bruto;
      acc.taxa += f.taxa;
      acc.salao += f.salao;
      acc.porProfissional[s.profissional] = (acc.porProfissional[s.profissional] ?? 0) + f.profissional;
      return acc;
    },
    { bruto: 0, taxa: 0, salao: 0, porProfissional: {} as Record<string, number> },
  );

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }

  function confirmarFinalizacao() {
    if (!finalizando) return;
    const r = calcularRepasse(servicoById(finalizando.servicoId).preco, forma);
    setSessoes((prev) =>
      prev.map((s) =>
        s.id === finalizando.id
          ? { ...s, finalizada: { forma, bruto: r.bruto, taxa: r.taxa, profissional: r.profissional, salao: r.salao } }
          : s,
      ),
    );
    setFinalizando(null);
    trackDemo('finalizar');
    showToast('Atendimento finalizado — já entrou no financeiro e no repasse.');
  }

  function confirmarAgendamentoLink() {
    if (!bookHorario || !bookNome.trim()) return;
    const nova: Sessao = {
      id: `l${Date.now()}`,
      horario: bookHorario,
      cliente: bookNome.trim(),
      servicoId: bookServico,
      profissional: PROFISSIONAIS[0].nome,
      origem: 'link',
    };
    setSessoes((prev) => [...prev, nova]);
    setBookHorario(null);
    setBookNome('');
    trackDemo('autoagendamento');
    setAba('agenda');
    showToast(`${nova.cliente} marcou sozinha às ${nova.horario} — caiu na agenda.`);
  }

  const corProfissional = (nome: string) =>
    PROFISSIONAIS.find((p) => p.nome === nome)?.cor ?? P;

  const textoLembrete = lembrete
    ? `Oi, ${lembrete.cliente.split(' ')[0]}! Passando para lembrar da sua ${servicoById(
        lembrete.servicoId,
      ).nome.toLowerCase()} amanhã às ${lembrete.horario} com a ${lembrete.profissional}. Posso confirmar? 💇‍♀️`
    : '';

  const previewRepasse = finalizando
    ? calcularRepasse(servicoById(finalizando.servicoId).preco, forma)
    : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-28 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-white/10" style={{ backgroundColor: P }}>
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandLogoIcon size={28} />
            <span className="text-sm font-semibold text-white">{productName}</span>
          </Link>
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: `${A}e6`, color: '#1a1208' }}
          >
            Demonstração
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-5">
        <h1 className="text-xl font-bold tracking-tight">Teste o salão por dentro</h1>
        <p className="mt-1 text-sm text-slate-600">
          Dados de exemplo, sem cadastro. Finalize um atendimento, marque pelo link da cliente e
          veja o repasse da equipe.
        </p>

        <nav className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {(
            [
              { id: 'agenda', label: 'Agenda', Icon: CalendarDays },
              { id: 'link', label: 'Link da cliente', Icon: Link2 },
              { id: 'financeiro', label: 'Financeiro', Icon: Wallet },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setAba(id);
                trackDemo(`aba_${id}`);
              }}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition ${
                aba === id ? 'text-white' : 'text-slate-600'
              }`}
              style={aba === id ? { backgroundColor: S } : undefined}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </nav>

        {aba === 'agenda' && (
          <section className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold">Hoje</p>
              <button
                type="button"
                onClick={() => setAba('link')}
                className="inline-flex items-center gap-1 text-xs font-semibold"
                style={{ color: S }}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Cliente marcar sozinha
              </button>
            </div>
            <ul className="divide-y divide-slate-100">
              {ordenadas.map((s) => {
                const serv = servicoById(s.servicoId);
                return (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-11 shrink-0 text-xs font-semibold tabular-nums text-slate-500">
                      {s.horario}
                    </span>
                    <span
                      className="h-10 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: corProfissional(s.profissional) }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {s.cliente}
                        {s.origem === 'link' && (
                          <span
                            className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{ backgroundColor: `${S}1f`, color: P }}
                          >
                            pelo link
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {serv.nome} · {s.profissional} · {formatCurrency(serv.preco)}
                      </p>
                    </div>
                    {s.finalizada ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                        <Check className="h-3 w-3" aria-hidden />
                        Finalizada
                      </span>
                    ) : (
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          aria-label="Lembrete no WhatsApp"
                          onClick={() => {
                            setLembrete(s);
                            trackDemo('lembrete');
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-emerald-600"
                        >
                          <MessageCircle className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setForma('pix');
                            setFinalizando(s);
                          }}
                          className="rounded-xl px-3 text-xs font-semibold text-white"
                          style={{ backgroundColor: P }}
                        >
                          Finalizar
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {aba === 'link' && (
          <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-medium text-slate-500">
              turquesaagenda.com.br/agendar/<strong>seu-salao</strong>
            </p>
            <h2 className="mt-1 text-base font-bold">Assim a cliente vê seu link</h2>

            <p className="mt-4 text-sm font-semibold">1. Serviço</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SERVICOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setBookServico(s.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    bookServico === s.id ? 'text-white' : 'border border-slate-200 text-slate-700'
                  }`}
                  style={bookServico === s.id ? { backgroundColor: S } : undefined}
                >
                  {s.nome} · {formatCurrency(s.preco)}
                </button>
              ))}
            </div>

            <p className="mt-4 text-sm font-semibold">2. Horário vago hoje</p>
            {livres.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Agenda cheia na demo — lindo, né?</p>
            ) : (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {livres.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setBookHorario(h)}
                    className={`min-h-11 rounded-xl text-sm font-semibold ${
                      bookHorario === h ? 'text-white' : 'border border-slate-200 text-slate-700'
                    }`}
                    style={bookHorario === h ? { backgroundColor: S } : undefined}
                  >
                    {h}
                  </button>
                ))}
              </div>
            )}

            <label className="mt-4 block text-sm font-semibold">
              3. Nome da cliente
              <input
                value={bookNome}
                onChange={(e) => setBookNome(e.target.value)}
                placeholder="Ex.: Beatriz Lima"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-base font-normal outline-none focus:border-[#047482]"
              />
            </label>

            <button
              type="button"
              onClick={confirmarAgendamentoLink}
              disabled={!bookHorario || !bookNome.trim()}
              className="mt-4 min-h-12 w-full rounded-2xl text-sm font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: P }}
            >
              Confirmar agendamento
            </button>
            <p className="mt-2 text-center text-xs text-slate-500">
              No real, o horário cai na agenda Google da profissional na hora.
            </p>
          </section>
        )}

        {aba === 'financeiro' && (
          <section className="mt-4 space-y-3">
            {finalizadas.length === 0 ? (
              <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
                <p className="text-sm font-semibold">Nenhum atendimento finalizado ainda</p>
                <p className="mt-1 text-xs text-slate-500">
                  Volte na Agenda e toque em <strong>Finalizar</strong> — o repasse aparece aqui.
                </p>
                <button
                  type="button"
                  onClick={() => setAba('agenda')}
                  className="mt-3 rounded-xl px-4 py-2 text-xs font-semibold text-white"
                  style={{ backgroundColor: P }}
                >
                  Ir para a agenda
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <p className="text-xs text-slate-500">Entradas hoje</p>
                    <p className="mt-1 text-lg font-bold" style={{ color: P }}>
                      {formatCurrency(totais.bruto)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <p className="text-xs text-slate-500">Parte do salão</p>
                    <p className="mt-1 text-lg font-bold" style={{ color: P }}>
                      {formatCurrency(totais.salao)}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <p className="text-sm font-semibold">Repasse da equipe ({COMISSAO_PERCENT}%)</p>
                  <ul className="mt-2 space-y-1.5">
                    {Object.entries(totais.porProfissional).map(([nome, valor]) => (
                      <li key={nome} className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: corProfissional(nome) }}
                            aria-hidden
                          />
                          {nome}
                        </span>
                        <span className="font-semibold tabular-nums">{formatCurrency(valor)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-slate-500">
                    Taxas de cartão descontadas antes da comissão: {formatCurrency(totais.taxa)}
                  </p>
                </div>
              </>
            )}
          </section>
        )}
      </main>

      {finalizando && previewRepasse && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-lg rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-bold">Finalizar atendimento</p>
                <p className="text-xs text-slate-500">
                  {finalizando.cliente} · {servicoById(finalizando.servicoId).nome} ·{' '}
                  {finalizando.profissional}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setFinalizando(null)}
                className="rounded-full p-1 text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 text-sm font-semibold">Forma de pagamento</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {FORMAS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setForma(f.id)}
                  className={`min-h-11 rounded-xl text-sm font-semibold ${
                    forma === f.id ? 'text-white' : 'border border-slate-200 text-slate-700'
                  }`}
                  style={forma === f.id ? { backgroundColor: S } : undefined}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <dl className="mt-4 space-y-1.5 rounded-2xl bg-[#F8FAFC] p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Valor</dt>
                <dd className="font-semibold tabular-nums">{formatCurrency(previewRepasse.bruto)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Taxa da maquininha</dt>
                <dd className="tabular-nums">− {formatCurrency(previewRepasse.taxa)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">
                  {finalizando.profissional} ({COMISSAO_PERCENT}%)
                </dt>
                <dd className="font-semibold tabular-nums">
                  {formatCurrency(previewRepasse.profissional)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <dt className="font-semibold">Fica para o salão</dt>
                <dd className="font-bold tabular-nums" style={{ color: P }}>
                  {formatCurrency(previewRepasse.salao)}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={confirmarFinalizacao}
              className="mt-4 min-h-12 w-full rounded-2xl text-sm font-bold text-white"
              style={{ backgroundColor: P }}
            >
              Confirmar
            </button>
          </div>
        </div>
      )}

      {lembrete && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-lg rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div className="flex items-start justify-between">
              <p className="text-base font-bold">Lembrete pronto para o WhatsApp</p>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setLembrete(null)}
                className="rounded-full p-1 text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 rounded-2xl rounded-tl-sm bg-[#dcf8c6] px-4 py-3 text-sm text-slate-800">
              {textoLembrete}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              No real, um toque abre o WhatsApp com a mensagem e o número da cliente. Você revisa e
              envia — sem taxa por mensagem.
            </p>
            <button
              type="button"
              onClick={() => setLembrete(null)}
              className="mt-4 min-h-12 w-full rounded-2xl text-sm font-bold text-white"
              style={{ backgroundColor: P }}
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
          <p className="max-w-md rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm text-white shadow-lg">
            {toast}
          </p>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-lg">
          <Link
            href={CTA_HREF}
            onClick={() => trackMetaCtaClick('demo_sticky')}
            className="flex min-h-12 w-full items-center justify-center rounded-2xl text-sm font-bold text-white"
            style={{ backgroundColor: P }}
          >
            Usar no meu salão — 30 dias grátis
          </Link>
          <p className="mt-1 text-center text-[11px] text-slate-500">Sem cartão · entra com Google</p>
        </div>
      </div>
    </div>
  );
}
