'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import type { CatalogoItemResumo } from '@/lib/atendimentoItens';
import { fetchCatalogoServicos } from '@/lib/catalogoServicosClient';
import { FORMAS_PAGAMENTO_ATENDIMENTO } from '@/lib/atendimentoFinalizar';
import { formatCurrency } from '@/lib/constants';
import CurrencyInput from '@/components/CurrencyInput';
import { formatValorBRLInput, parseValorBRL } from '@/lib/moeda';

export type VenderPacoteApiBody = {
  nome: string;
  servico_catalogo_id: string | null;
  sessoes_total: number;
  sessoes_ja_usadas: number;
  valor_total: number;
  forma_pagamento: string;
  parcelas: number;
  medico: string | null;
  validade: string | null;
  percentual_profissional?: number;
};

export type VenderPacoteFieldsHandle = {
  validate: () => string | null;
  toApiBody: () => VenderPacoteApiBody;
  getValorTotal: () => number;
  getSessoesTotal: () => number;
  getSessoesJaUsadas: () => number;
  reset: () => void;
};

type Props = {
  medicos?: string[];
  /** Reserva ao menos 1 sessão para o atendimento atual (fechamento). */
  reservarSessaoAtual?: boolean;
  /** Prefill do profissional que está fechando. */
  medicoInicial?: string;
  /** Comissão do fechamento (vai para o financeiro da venda). */
  percentualProfissional?: number;
  disabled?: boolean;
  compact?: boolean;
  /** Notifica valor total e sessões enquanto a profissional preenche. */
  onDraftChange?: (draft: {
    valorTotal: number;
    sessoesTotal: number;
    sessoesJaUsadas: number;
  }) => void;
  /** Prefill opcional (fixtures / testes de UI). */
  initialValues?: Partial<{
    nome: string;
    sessoes: string;
    sessoesJaUsadas: string;
    valor: string;
  }>;
};

const VenderPacoteFields = forwardRef<VenderPacoteFieldsHandle, Props>(
  function VenderPacoteFields(
    {
      medicos = [],
      reservarSessaoAtual = false,
      medicoInicial = '',
      percentualProfissional,
      disabled = false,
      compact = false,
      onDraftChange,
      initialValues,
    },
    ref,
  ) {
    const [catalogo, setCatalogo] = useState<CatalogoItemResumo[]>([]);
    const [servicoId, setServicoId] = useState('');
    const [nome, setNome] = useState(initialValues?.nome ?? '');
    const [sessoes, setSessoes] = useState(initialValues?.sessoes ?? '10');
    const [sessoesJaUsadas, setSessoesJaUsadas] = useState(
      initialValues?.sessoesJaUsadas ?? '0',
    );
    const [valor, setValor] = useState(initialValues?.valor ?? '');
    const [forma, setForma] = useState('pix');
    const [parcelas, setParcelas] = useState('1');
    const [medico, setMedico] = useState(medicoInicial);
    const [validadeDias, setValidadeDias] = useState('');

    useEffect(() => {
      let cancelled = false;
      fetchCatalogoServicos()
        .then((items) => {
          if (!cancelled) {
            setCatalogo(items.filter((i) => i.tipo === 'servico' && i.ativo !== false));
          }
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      if (medicoInicial) setMedico(medicoInicial);
    }, [medicoInicial]);

    useEffect(() => {
      onDraftChange?.({
        valorTotal: parseValorBRL(valor),
        sessoesTotal: Math.max(0, Math.floor(Number(sessoes) || 0)),
        sessoesJaUsadas: Math.max(0, Math.floor(Number(sessoesJaUsadas) || 0)),
      });
    }, [valor, sessoes, sessoesJaUsadas, onDraftChange]);

    const sessoesNum = Math.max(0, Math.floor(Number(sessoes) || 0));
    const jaUsadasNum = Math.max(0, Math.floor(Number(sessoesJaUsadas) || 0));
    const maxJaUsadas = reservarSessaoAtual
      ? Math.max(0, sessoesNum - 1)
      : sessoesNum;
    const restantesAposVenda = Math.max(
      0,
      sessoesNum - jaUsadasNum - (reservarSessaoAtual ? 1 : 0),
    );

    const resumoSessoes = useMemo(() => {
      if (sessoesNum < 1) return null;
      const feitas: string[] = [];
      for (let i = 1; i <= Math.min(jaUsadasNum, sessoesNum); i++) {
        feitas.push(`${i}ª`);
      }
      if (reservarSessaoAtual && sessoesNum > jaUsadasNum) {
        feitas.push(`${jaUsadasNum + 1}ª (este atendimento)`);
      }
      return feitas;
    }, [sessoesNum, jaUsadasNum, reservarSessaoAtual]);

    function onSelectServico(id: string) {
      setServicoId(id);
      const s = catalogo.find((c) => c.id === id);
      if (!s) return;
      const qtd = Math.max(1, Math.floor(Number(sessoes) || 1));
      setNome(`${qtd} sessões de ${s.nome}`);
      if (!valor && s.preco_centavos > 0) {
        setValor(formatValorBRLInput((s.preco_centavos / 100) * qtd));
      }
    }

    function reset() {
      setServicoId('');
      setNome('');
      setSessoes('10');
      setSessoesJaUsadas('0');
      setValor('');
      setForma('pix');
      setParcelas('1');
      setMedico(medicoInicial);
      setValidadeDias('');
    }

    useImperativeHandle(
      ref,
      () => ({
        validate() {
          const qtd = Math.floor(Number(sessoes));
          if (!nome.trim() || nome.trim().length < 2) {
            return 'Informe o nome do pacote.';
          }
          if (!Number.isFinite(qtd) || qtd < 1 || qtd > 200) {
            return 'Informe a quantidade de sessões (1 a 200).';
          }
          const ja = Math.floor(Number(sessoesJaUsadas) || 0);
          if (!Number.isFinite(ja) || ja < 0) {
            return 'Informe quantas sessões já foram feitas.';
          }
          const max = reservarSessaoAtual ? qtd - 1 : qtd;
          if (ja > max) {
            return reservarSessaoAtual
              ? `Com este atendimento, no máximo ${max} sessão(ões) podem estar feitas antes.`
              : 'Sessões já feitas não podem passar do total.';
          }
          if (reservarSessaoAtual && qtd < 1) {
            return 'O pacote precisa ter ao menos 1 sessão para este atendimento.';
          }
          const valorNum = parseValorBRL(valor);
          if (valorNum < 0) return 'Valor do pacote inválido.';
          return null;
        },
        toApiBody() {
          const qtd = Math.floor(Number(sessoes));
          const ja = Math.min(
            Math.max(0, Math.floor(Number(sessoesJaUsadas) || 0)),
            reservarSessaoAtual ? qtd - 1 : qtd,
          );
          const dias = Math.floor(Number(validadeDias));
          const validade =
            dias > 0
              ? new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10)
              : null;
          const body: VenderPacoteApiBody = {
            nome: nome.trim(),
            servico_catalogo_id: servicoId || null,
            sessoes_total: qtd,
            sessoes_ja_usadas: ja,
            valor_total: parseValorBRL(valor),
            forma_pagamento: forma,
            parcelas: Math.max(1, Number(parcelas) || 1),
            medico: medico || null,
            validade,
          };
          if (
            percentualProfissional != null &&
            Number.isFinite(percentualProfissional)
          ) {
            body.percentual_profissional = percentualProfissional;
          }
          return body;
        },
        getValorTotal: () => parseValorBRL(valor),
        getSessoesTotal: () => Math.floor(Number(sessoes) || 0),
        getSessoesJaUsadas: () => Math.floor(Number(sessoesJaUsadas) || 0),
        reset,
      }),
      [
        nome,
        sessoes,
        sessoesJaUsadas,
        valor,
        forma,
        parcelas,
        medico,
        validadeDias,
        servicoId,
        reservarSessaoAtual,
        percentualProfissional,
        medicoInicial,
      ],
    );

    const fieldClass =
      'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-60';
    const labelClass = 'mb-1 block text-xs font-medium text-gray-700';

    return (
      <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
        {catalogo.length > 0 && (
          <div>
            <label className={labelClass}>Serviço do catálogo</label>
            <select
              value={servicoId}
              onChange={(e) => onSelectServico(e.target.value)}
              disabled={disabled}
              className={fieldClass}
            >
              <option value="">— escolher (opcional) —</option>
              {catalogo.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} · {formatCurrency(s.preco_centavos / 100)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className={labelClass}>Nome do pacote *</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={disabled}
              placeholder="Ex.: 10 sessões de depilação"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Sessões *</label>
            <input
              type="number"
              min={1}
              max={200}
              value={sessoes}
              onChange={(e) => {
                setSessoes(e.target.value);
                const nextTotal = Math.floor(Number(e.target.value) || 0);
                const max = reservarSessaoAtual
                  ? Math.max(0, nextTotal - 1)
                  : nextTotal;
                if (jaUsadasNum > max) setSessoesJaUsadas(String(max));
              }}
              disabled={disabled}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="rounded-lg border border-[#047482]/20 bg-white/80 p-2.5">
          <label className={labelClass}>
            {reservarSessaoAtual
              ? 'Sessões já feitas antes deste atendimento'
              : 'Sessões já feitas'}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled || jaUsadasNum <= 0}
              onClick={() => setSessoesJaUsadas(String(Math.max(0, jaUsadasNum - 1)))}
              className="h-9 w-9 shrink-0 rounded-lg border border-gray-200 text-lg font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              aria-label="Diminuir sessões já feitas"
            >
              −
            </button>
            <input
              type="number"
              min={0}
              max={maxJaUsadas}
              value={sessoesJaUsadas}
              onChange={(e) => {
                const n = Math.floor(Number(e.target.value) || 0);
                setSessoesJaUsadas(String(Math.max(0, Math.min(maxJaUsadas, n))));
              }}
              disabled={disabled}
              className={`${fieldClass} text-center font-semibold`}
            />
            <button
              type="button"
              disabled={disabled || jaUsadasNum >= maxJaUsadas}
              onClick={() =>
                setSessoesJaUsadas(String(Math.min(maxJaUsadas, jaUsadasNum + 1)))
              }
              className="h-9 w-9 shrink-0 rounded-lg border border-gray-200 text-lg font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              aria-label="Aumentar sessões já feitas"
            >
              +
            </button>
          </div>
          <p className="mt-1.5 text-xs text-gray-600">
            {reservarSessaoAtual
              ? `Este atendimento desconta 1 sessão. Restarão ${restantesAposVenda} de ${sessoesNum || '—'}.`
              : `Restarão ${Math.max(0, sessoesNum - jaUsadasNum)} de ${sessoesNum || '—'} após a venda.`}
          </p>
          {resumoSessoes && resumoSessoes.length > 0 && (
            <p className="mt-1 text-xs text-[#035e6b]">
              Marcadas: {resumoSessoes.join(', ')}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Valor total (R$)</label>
            <CurrencyInput
              value={valor}
              onChange={setValor}
              disabled={disabled}
              placeholder="0,00"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Validade (dias)</label>
            <input
              type="number"
              min={0}
              value={validadeDias}
              onChange={(e) => setValidadeDias(e.target.value)}
              disabled={disabled}
              placeholder="Sem validade"
              className={fieldClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Pagamento</label>
            <select
              value={forma}
              onChange={(e) => setForma(e.target.value)}
              disabled={disabled}
              className={fieldClass}
            >
              {FORMAS_PAGAMENTO_ATENDIMENTO.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Parcelas</label>
            <select
              value={parcelas}
              onChange={(e) => setParcelas(e.target.value)}
              disabled={disabled}
              className={fieldClass}
            >
              {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                <option key={n} value={String(n)}>
                  {n === 1 ? 'À vista' : `${n}x`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {medicos.length > 0 && (
          <div>
            <label className={labelClass}>
              Profissional que vendeu (comissão)
            </label>
            <select
              value={medico}
              onChange={(e) => setMedico(e.target.value)}
              disabled={disabled}
              className={fieldClass}
            >
              <option value="">Salão (sem comissão)</option>
              {medicos.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  },
);

export default VenderPacoteFields;

export async function postVenderPacote(
  clienteId: string,
  body: VenderPacoteApiBody,
): Promise<{ pacote: { id: string; nome: string; sessoes_total: number }; financeiro_registrado: boolean }> {
  const res = await fetch(`/api/clientes/${encodeURIComponent(clienteId)}/pacotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : 'Erro ao vender pacote',
    );
  }
  return data;
}
