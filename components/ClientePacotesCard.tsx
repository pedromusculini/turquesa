'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageCircle, Package, Plus, Undo2, X } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import PacoteWhatsAppPrompt, { type PacoteWhatsAppData } from '@/components/PacoteWhatsAppPrompt';
import type { ClientePacote } from '@/lib/types';
import type { CatalogoItemResumo } from '@/lib/atendimentoItens';
import { fetchCatalogoServicos } from '@/lib/catalogoServicosClient';
import { FORMAS_PAGAMENTO_ATENDIMENTO } from '@/lib/atendimentoFinalizar';
import { formatCurrency } from '@/lib/constants';
import CurrencyInput from '@/components/CurrencyInput';
import { formatValorBRLInput, parseValorBRL } from '@/lib/moeda';

function restantes(p: ClientePacote): number {
  return Math.max(0, p.sessoes_total - p.usos.length);
}

function formatData(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function statusLabel(p: ClientePacote): { text: string; className: string } {
  const hoje = new Date().toISOString().slice(0, 10);
  if (p.status === 'cancelado') return { text: 'Cancelado', className: 'bg-gray-100 text-gray-600' };
  if (p.status === 'concluido' || restantes(p) === 0) {
    return { text: 'Concluído', className: 'bg-gray-100 text-gray-600' };
  }
  if (p.validade && p.validade < hoje) return { text: 'Vencido', className: 'bg-red-50 text-red-700' };
  return { text: 'Ativo', className: 'bg-[#D9F0F2] text-[#035e6b]' };
}

export default function ClientePacotesCard({
  clienteId,
  pacotes,
  medicos,
  onChanged,
}: {
  clienteId: string;
  pacotes: ClientePacote[];
  medicos: string[];
  onChanged: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [vendendo, setVendendo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoItemResumo[]>([]);
  const [servicoId, setServicoId] = useState('');
  const [nome, setNome] = useState('');
  const [sessoes, setSessoes] = useState('10');
  const [valor, setValor] = useState('');
  const [forma, setForma] = useState<string>('pix');
  const [parcelas, setParcelas] = useState('1');
  const [medico, setMedico] = useState('');
  const [validadeDias, setValidadeDias] = useState('');
  const [mostrarEncerrados, setMostrarEncerrados] = useState(false);
  const [prompt, setPrompt] = useState<{
    data: PacoteWhatsAppData;
    resumo: string | null;
  } | null>(null);

  useEffect(() => {
    if (!vendendo || catalogo.length > 0) return;
    fetchCatalogoServicos()
      .then((items) => setCatalogo(items.filter((i) => i.tipo === 'servico' && i.ativo !== false)))
      .catch(() => undefined);
  }, [vendendo, catalogo.length]);

  const { ativos, encerrados } = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const a: ClientePacote[] = [];
    const e: ClientePacote[] = [];
    for (const p of pacotes) {
      const ok = p.status === 'ativo' && restantes(p) > 0 && !(p.validade && p.validade < hoje);
      (ok ? a : e).push(p);
    }
    return { ativos: a, encerrados: e };
  }, [pacotes]);

  function onSelectServico(id: string) {
    setServicoId(id);
    const s = catalogo.find((c) => c.id === id);
    if (!s) return;
    const qtd = Math.max(1, Number(sessoes) || 1);
    setNome(`${qtd} sessões de ${s.nome}`);
    if (!valor && s.preco_centavos > 0) {
      setValor(formatValorBRLInput((s.preco_centavos / 100) * qtd));
    }
  }

  function resetForm() {
    setServicoId('');
    setNome('');
    setSessoes('10');
    setValor('');
    setForma('pix');
    setParcelas('1');
    setMedico('');
    setValidadeDias('');
  }

  async function vender(e: React.FormEvent) {
    e.preventDefault();
    const qtd = Math.floor(Number(sessoes));
    if (!nome.trim() || !qtd || qtd < 1) {
      toast.error('Informe o nome e a quantidade de sessões.');
      return;
    }
    const dias = Math.floor(Number(validadeDias));
    const validade =
      dias > 0 ? new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10) : null;
    setSaving(true);
    try {
      const res = await fetch(`/api/clientes/${encodeURIComponent(clienteId)}/pacotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          servico_catalogo_id: servicoId || null,
          sessoes_total: qtd,
          valor_total: parseValorBRL(valor),
          forma_pagamento: forma,
          parcelas: Math.max(1, Number(parcelas) || 1),
          medico: medico || null,
          validade,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao vender pacote');
      toast.success(
        data.financeiro_registrado === false
          ? 'Pacote criado, mas não entrou no financeiro. Lance a entrada manualmente.'
          : 'Pacote vendido e lançado no financeiro.',
      );
      resetForm();
      setVendendo(false);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao vender pacote');
    } finally {
      setSaving(false);
    }
  }

  async function patch(pacoteId: string, body: Record<string, string>, okMsg: string) {
    setBusyId(pacoteId);
    try {
      const res = await fetch(
        `/api/clientes/${encodeURIComponent(clienteId)}/pacotes/${encodeURIComponent(pacoteId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar pacote');
      toast.success(okMsg);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar pacote');
    } finally {
      setBusyId(null);
    }
  }

  async function abrirControleWhatsApp(pacoteId: string) {
    setBusyId(pacoteId);
    try {
      const res = await fetch(
        `/api/clientes/${encodeURIComponent(clienteId)}/pacotes/${encodeURIComponent(pacoteId)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao montar mensagem');
      const pacote = pacotes.find((x) => x.id === pacoteId);
      setPrompt({
        data: data as PacoteWhatsAppData,
        resumo: pacote ? `${pacote.nome} — ${restantes(pacote)} de ${pacote.sessoes_total} restante(s)` : null,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao montar mensagem');
    } finally {
      setBusyId(null);
    }
  }

  function renderPacote(p: ClientePacote) {
    const st = statusLabel(p);
    const usados = p.usos.length;
    const pct = p.sessoes_total > 0 ? Math.min(100, (usados / p.sessoes_total) * 100) : 0;
    const usosOrdenados = [...p.usos].sort((a, b) => a.data.localeCompare(b.data));
    const ultimoUso = p.usos[p.usos.length - 1];
    const valorSessao = p.sessoes_total > 0 ? p.valor_total / p.sessoes_total : 0;
    const consumido = Math.min(p.valor_total, valorSessao * usados);
    const formaLabel =
      FORMAS_PAGAMENTO_ATENDIMENTO.find((f) => f.id === p.forma_pagamento)?.label ??
      p.forma_pagamento;
    return (
      <li key={p.id} className="rounded-lg border border-gray-100 bg-[#fafafa] p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-gray-900">{p.nome}</p>
            <p className="text-xs text-gray-500">
              Vendido em {formatData(p.data_venda)}
              {p.medico ? ` por ${p.medico}` : ''}
              {p.validade ? ` · válido até ${formatData(p.validade)}` : ''}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${st.className}`}>
            {st.text}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full bg-[#047482]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-semibold text-gray-700">
            {restantes(p)} de {p.sessoes_total} restante(s)
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-gray-500">Valor pago</dt>
            <dd className="font-semibold text-gray-900">
              {formatCurrency(p.valor_total)}
              <span className="font-normal text-gray-500">
                {' '}
                · {formaLabel}
                {p.parcelas > 1 ? ` ${p.parcelas}x` : ''}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Por sessão</dt>
            <dd className="font-semibold text-gray-900">{formatCurrency(valorSessao)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Já usado</dt>
            <dd className="font-semibold text-gray-900">{formatCurrency(consumido)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Saldo</dt>
            <dd className="font-semibold text-[#047482]">
              {formatCurrency(p.status === 'cancelado' ? 0 : p.valor_total - consumido)}
            </dd>
          </div>
        </dl>
        {usosOrdenados.length > 0 && (
          <ol className="mt-2 space-y-0.5 text-xs text-gray-600">
            {usosOrdenados.map((u, i) => (
              <li key={u.id}>
                ✅ {i + 1}ª sessão — {formatData(u.data)}
                {u.medico ? ` · ${u.medico}` : ''}
              </li>
            ))}
          </ol>
        )}
        {p.status !== 'cancelado' && (
          <div className="mt-2 flex flex-wrap gap-3">
            {ultimoUso && (
              <button
                type="button"
                disabled={busyId === p.id}
                onClick={() => void abrirControleWhatsApp(p.id)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#128C7E] hover:underline disabled:opacity-50"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                Enviar controle no WhatsApp
              </button>
            )}
            {ultimoUso && (
              <button
                type="button"
                disabled={busyId === p.id}
                onClick={() =>
                  void patch(
                    p.id,
                    { acao: 'estornar_uso', uso_id: ultimoUso.id },
                    'Última sessão devolvida ao pacote.',
                  )
                }
                className="inline-flex items-center gap-1 text-xs font-medium text-[#047482] hover:underline disabled:opacity-50"
              >
                <Undo2 className="h-3.5 w-3.5" aria-hidden />
                Devolver última sessão
              </button>
            )}
            <button
              type="button"
              disabled={busyId === p.id}
              onClick={() => {
                if (window.confirm('Cancelar este pacote? As sessões restantes deixam de poder ser usadas.')) {
                  void patch(p.id, { acao: 'cancelar' }, 'Pacote cancelado.');
                }
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Cancelar pacote
            </button>
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <PacoteWhatsAppPrompt
        data={prompt?.data ?? null}
        resumo={prompt?.resumo}
        onClose={() => setPrompt(null)}
      />
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-medium text-gray-900">
          <Package className="h-4 w-4 text-[#047482]" />
          Pacotes de sessões
        </p>
        {!vendendo && (
          <button
            type="button"
            onClick={() => setVendendo(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#047482] hover:underline touch-manipulation"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Vender pacote
          </button>
        )}
      </div>

      {vendendo && (
        <form onSubmit={vender} className="mb-4 space-y-3 rounded-lg border border-[#047482]/20 bg-[#eef4f5] p-3">
          {catalogo.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Serviço do catálogo</label>
              <select
                value={servicoId}
                onChange={(e) => onSelectServico(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
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
              <label className="mb-1 block text-xs font-medium text-gray-700">Nome do pacote *</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: 10 sessões de depilação"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Sessões *</label>
              <input
                type="number"
                min={1}
                max={200}
                value={sessoes}
                onChange={(e) => setSessoes(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Valor total (R$)</label>
              <CurrencyInput
                value={valor}
                onChange={setValor}
                placeholder="0,00"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Validade (dias)</label>
              <input
                type="number"
                min={0}
                value={validadeDias}
                onChange={(e) => setValidadeDias(e.target.value)}
                placeholder="Sem validade"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Pagamento</label>
              <select
                value={forma}
                onChange={(e) => setForma(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                {FORMAS_PAGAMENTO_ATENDIMENTO.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Parcelas</label>
              <select
                value={parcelas}
                onChange={(e) => setParcelas(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
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
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Profissional que vendeu (comissão)
              </label>
              <select
                value={medico}
                onChange={(e) => setMedico(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setVendendo(false);
              }}
              disabled={saving}
              className="flex-1 rounded-lg border border-gray-200 bg-white py-2 text-sm font-medium text-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#047482] py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Vender e lançar no financeiro
            </button>
          </div>
        </form>
      )}

      {ativos.length === 0 && !vendendo && (
        <p className="text-xs text-gray-500">
          Nenhum pacote ativo. Venda sessões adiantadas (ex.: 10 depilações) e o sistema desconta uma
          a cada atendimento.
        </p>
      )}
      {ativos.length > 0 && <ul className="space-y-3">{ativos.map(renderPacote)}</ul>}

      {encerrados.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setMostrarEncerrados((v) => !v)}
            className="text-xs font-medium text-gray-500 hover:underline"
          >
            {mostrarEncerrados ? 'Ocultar' : 'Ver'} pacotes encerrados ({encerrados.length})
          </button>
          {mostrarEncerrados && <ul className="mt-2 space-y-3">{encerrados.map(renderPacote)}</ul>}
        </div>
      )}
    </div>
  );
}
