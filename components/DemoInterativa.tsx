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

/** Mesmos passos do link real (`AgendarPublicoClient`). */
type BookStep = 'telefone' | 'cadastro' | 'profissional' | 'horario' | 'confirmar' | 'sucesso';

function mascaraTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function DemoInterativa() {
  const [aba, setAba] = useState<Aba>('agenda');
  const [sessoes, setSessoes] = useState<Sessao[]>(SESSOES_INICIAIS);
  const [finalizando, setFinalizando] = useState<Sessao | null>(null);
  const [forma, setForma] = useState<FormaPagamento>('pix');
  const [lembrete, setLembrete] = useState<Sessao | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [bookStep, setBookStep] = useState<BookStep>('telefone');
  const [bookTel, setBookTel] = useState('');
  const [bookNome, setBookNome] = useState('');
  const [bookProf, setBookProf] = useState<string>('');
  const [bookHorario, setBookHorario] = useState<string | null>(null);
  const [bookConsent, setBookConsent] = useState(false);

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
    if (!bookHorario || !bookNome.trim() || !bookProf || !bookConsent) return;
    const nova: Sessao = {
      id: `l${Date.now()}`,
      horario: bookHorario,
      cliente: bookNome.trim(),
      servicoId: 'escova',
      profissional: bookProf,
      origem: 'link',
    };
    setSessoes((prev) => [...prev, nova]);
    trackDemo('autoagendamento');
    setBookStep('sucesso');
  }

  function reiniciarLink() {
    setBookStep('telefone');
    setBookTel('');
    setBookNome('');
    setBookProf('');
    setBookHorario(null);
    setBookConsent(false);
  }

  function voltarLink() {
    const anterior: Partial<Record<BookStep, BookStep>> = {
      cadastro: 'telefone',
      profissional: 'cadastro',
      horario: 'profissional',
      confirmar: 'horario',
    };
    setBookStep(anterior[bookStep] ?? 'telefone');
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
          <section className="mt-4">
            <p className="mb-2 text-center text-xs text-slate-500">
              Assim a cliente vê <strong>turquesaagenda.com.br/agendar/seu-salao</strong>
            </p>
            <div className="overflow-hidden rounded-3xl bg-gradient-to-b from-[#eef4f5] to-[#f8f9fa] ring-1 ring-slate-200">
              <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-4">
                <BrandLogoIcon size={40} className="h-10 w-10 rounded-xl" />
                <div>
                  <p className="text-xs text-gray-500">Agendar sessão</p>
                  <p className="font-bold leading-tight text-gray-900">Studio Exemplo</p>
                </div>
              </div>

              <div className="px-4 py-5">
                {bookStep === 'sucesso' ? (
                  <div className="py-6 text-center">
                    <Check className="mx-auto mb-3 h-14 w-14 rounded-full bg-[#047482] p-3 text-white" />
                    <p className="text-2xl font-bold text-gray-900">Sessão reservada!</p>
                    <p className="mt-2 text-gray-600">
                      Studio Exemplo receberá sua reserva. Guarde este comprovante.
                    </p>
                    <div className="mt-5 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setAba('agenda')}
                        className="w-full rounded-xl bg-[#047482] py-3.5 text-sm font-semibold text-white"
                      >
                        Ver na agenda do salão
                      </button>
                      <button
                        type="button"
                        onClick={reiniciarLink}
                        className="text-sm font-medium text-[#047482]"
                      >
                        Agendar outra
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {bookStep !== 'telefone' && (
                      <button
                        type="button"
                        onClick={voltarLink}
                        className="mb-4 text-sm font-medium text-[#047482]"
                      >
                        ‹ Voltar
                      </button>
                    )}
                    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-md">
                      {bookStep === 'telefone' && (
                        <div className="space-y-4">
                          <p className="text-lg font-bold text-gray-900">Seu WhatsApp</p>
                          <p className="text-sm text-gray-500">
                            Usamos o telefone para identificar se você já é cliente.
                          </p>
                          <input
                            type="tel"
                            inputMode="tel"
                            value={bookTel}
                            onChange={(e) => setBookTel(mascaraTelefone(e.target.value))}
                            placeholder="(11) 99999-9999"
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base"
                          />
                          <button
                            type="button"
                            disabled={bookTel.replace(/\D/g, '').length < 10}
                            onClick={() => setBookStep('cadastro')}
                            className="w-full rounded-xl bg-[#047482] py-3.5 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            Continuar ›
                          </button>
                        </div>
                      )}

                      {bookStep === 'cadastro' && (
                        <div className="space-y-4">
                          <p className="text-lg font-bold text-gray-900">Seus dados</p>
                          <input
                            value={bookNome}
                            onChange={(e) => setBookNome(e.target.value)}
                            placeholder="Nome completo *"
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base"
                          />
                          <button
                            type="button"
                            disabled={bookNome.trim().length < 2}
                            onClick={() => setBookStep('profissional')}
                            className="w-full rounded-xl bg-[#047482] py-3.5 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            Continuar
                          </button>
                        </div>
                      )}

                      {bookStep === 'profissional' && (
                        <div className="space-y-4">
                          <p className="text-sm font-semibold text-gray-900">Profissional *</p>
                          <div className="space-y-2">
                            {PROFISSIONAIS.map((p) => (
                              <button
                                key={p.nome}
                                type="button"
                                onClick={() => setBookProf(p.nome)}
                                className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm font-medium ${
                                  bookProf === p.nome
                                    ? 'border-[#047482] bg-[#eef4f5] text-[#047482]'
                                    : 'border-gray-100 text-gray-800'
                                }`}
                              >
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.cor }} />
                                {p.nome}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            disabled={!bookProf}
                            onClick={() => setBookStep('horario')}
                            className="w-full rounded-xl bg-[#047482] py-3.5 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            Continuar
                          </button>
                        </div>
                      )}

                      {bookStep === 'horario' && (
                        <div className="space-y-4">
                          <p className="text-lg font-bold text-gray-900">Data e horário</p>
                          <p className="text-sm text-gray-600">
                            Profissional: <strong>{bookProf}</strong> · hoje
                          </p>
                          {livres.length === 0 ? (
                            <p className="py-4 text-center text-sm text-gray-500">
                              Agenda cheia na demo — lindo, né?
                            </p>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {livres.map((h) => (
                                <button
                                  key={h}
                                  type="button"
                                  onClick={() => {
                                    setBookHorario(h);
                                    setBookStep('confirmar');
                                  }}
                                  className="rounded-xl border-2 border-gray-100 py-2.5 text-sm font-medium text-gray-800"
                                >
                                  {h}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {bookStep === 'confirmar' && bookHorario && (
                        <div className="space-y-4">
                          <p className="text-lg font-bold text-gray-900">Confirmar</p>
                          <dl className="space-y-2 rounded-xl bg-[#f8f9fa] p-4 text-sm">
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Cliente</dt>
                              <dd className="font-medium">{bookNome.trim()}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Profissional</dt>
                              <dd className="font-medium">{bookProf}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Horário</dt>
                              <dd className="font-medium">Hoje, {bookHorario}</dd>
                            </div>
                          </dl>
                          <label className="flex cursor-pointer items-start gap-2 text-xs text-gray-600">
                            <input
                              type="checkbox"
                              checked={bookConsent}
                              onChange={(e) => setBookConsent(e.target.checked)}
                              className="mt-0.5 rounded border-gray-300"
                            />
                            Autorizo o uso dos meus dados para este agendamento, conforme a política de
                            privacidade do salão (LGPD).
                          </label>
                          <button
                            type="button"
                            disabled={!bookConsent}
                            onClick={confirmarAgendamentoLink}
                            className="w-full rounded-xl bg-[#047482] py-3.5 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            Confirmar reserva
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
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
