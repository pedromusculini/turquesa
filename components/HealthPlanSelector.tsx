'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  PLANOS_SAUDE_ATENDIMENTO,
  PLANOS_SAUDE_OPERADORAS,
  PLANOS_SAUDE_TODOS,
  PLANO_SAUDE_OUTRO,
  TIER_LABEL,
  formatarOutroConvenio,
  parseSelecaoConvenios,
  type PlanoSaudeOption,
} from '@/lib/planosSaude';

type HealthPlanSelectorProps = {
  value: string;
  onChange: (csvLabels: string) => void;
  label?: string;
  hint?: string;
  required?: boolean;
  minSelected?: number;
};

function groupByTier(options: PlanoSaudeOption[]) {
  const order: PlanoSaudeOption['tier'][] = [
    'lider',
    'grande',
    'medio',
    'regional',
    'outro',
  ];
  const groups: Record<string, PlanoSaudeOption[]> = {};
  for (const o of options) {
    if (!groups[o.tier]) groups[o.tier] = [];
    groups[o.tier].push(o);
  }
  return order
    .filter((t) => groups[t]?.length)
    .map((t) => ({ tier: t, items: groups[t]! }));
}

function buildValue(padrao: string[], outrosTextos: string[]): string {
  const parts = [...padrao];
  for (const t of outrosTextos) {
    const formatted = formatarOutroConvenio(t);
    if (formatted) parts.push(formatted);
  }
  return parts.join(', ');
}

export default function HealthPlanSelector({
  value,
  onChange,
  label = 'Convênios / planos de saúde aceitos',
  hint = 'Selecione todos que você atende. Ordem: do mais utilizado no Brasil ao menos comum.',
  required = false,
  minSelected = 1,
}: HealthPlanSelectorProps) {
  const [busca, setBusca] = useState('');

  const { padrao, outros } = useMemo(() => parseSelecaoConvenios(value), [value]);
  const outroAtivo = padrao.includes(PLANO_SAUDE_OUTRO.label) || outros.length > 0;
  const outroTexto = outros[0] ?? '';

  const isSelected = (opt: PlanoSaudeOption) => padrao.includes(opt.label);

  function applyChange(novoPadrao: string[], novoOutroTexto: string, outroMarcado: boolean) {
    const p = novoPadrao.filter((l) => l !== PLANO_SAUDE_OUTRO.label);
    if (outroMarcado) p.push(PLANO_SAUDE_OUTRO.label);
    const outrosLista = outroMarcado && novoOutroTexto.trim() ? [novoOutroTexto.trim()] : [];
    onChange(buildValue(p, outrosLista));
  }

  function toggle(opt: PlanoSaudeOption) {
    if (opt.id === 'outro') {
      if (outroAtivo) {
        applyChange(
          padrao.filter((l) => l !== PLANO_SAUDE_OUTRO.label),
          '',
          false,
        );
      } else {
        applyChange(padrao, '', true);
      }
      return;
    }
    const next = isSelected(opt)
      ? padrao.filter((l) => l !== opt.label)
      : [...padrao.filter((l) => l !== PLANO_SAUDE_OUTRO.label), opt.label];
    applyChange(next, outroTexto, outroAtivo);
  }

  function setOutroTexto(text: string) {
    applyChange(
      padrao.filter((l) => l !== PLANO_SAUDE_OUTRO.label),
      text,
      true,
    );
  }

  function selectAllFiltered() {
    const term = busca.toLowerCase().trim();
    const pool = term
      ? PLANOS_SAUDE_TODOS.filter(
          (p) =>
            p.id !== 'outro' &&
            (p.label.toLowerCase().includes(term) || p.id.toLowerCase().includes(term)),
        )
      : PLANOS_SAUDE_TODOS.filter((p) => p.id !== 'outro');
    const merged = new Set([...padrao.filter((l) => l !== PLANO_SAUDE_OUTRO.label), ...pool.map((p) => p.label)]);
    applyChange(Array.from(merged), outroTexto, outroAtivo);
  }

  function clearAll() {
    onChange('');
  }

  const filteredOperadoras = useMemo(() => {
    const term = busca.toLowerCase().trim();
    if (!term) return PLANOS_SAUDE_OPERADORAS;
    return PLANOS_SAUDE_OPERADORAS.filter(
      (p) =>
        p.label.toLowerCase().includes(term) || p.id.toLowerCase().includes(term),
    );
  }, [busca]);

  const filteredAtendimento = useMemo(() => {
    const term = busca.toLowerCase().trim();
    if (!term) return PLANOS_SAUDE_ATENDIMENTO;
    return PLANOS_SAUDE_ATENDIMENTO.filter((p) =>
      p.label.toLowerCase().includes(term),
    );
  }, [busca]);

  const groups = groupByTier(filteredOperadoras);
  const count = padrao.filter((l) => l !== PLANO_SAUDE_OUTRO.label).length + (outroTexto ? 1 : 0);
  const outroInvalido = outroAtivo && !outroTexto.trim();
  const valid = (!required || count >= minSelected) && !outroInvalido;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-800">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </p>
        {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
        <p className="text-xs text-slate-600 mt-2">
          {count} selecionado{count !== 1 ? 's' : ''}
          {!valid && !outroInvalido && required && (
            <span className="text-red-600"> — selecione pelo menos {minSelected}</span>
          )}
          {outroInvalido && (
            <span className="text-red-600"> — informe o nome do outro convênio</span>
          )}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar Unimed, Bradesco, Amil..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-green-200 bg-white text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={selectAllFiltered}
          className="text-xs px-3 py-1.5 rounded-lg border border-green-200 text-green-800 hover:bg-green-50"
        >
          Marcar visíveis
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          Limpar
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-2xl border border-green-100 bg-[#fafffa] p-3 space-y-4">
        {groups.map(({ tier, items }) => (
          <div key={tier}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-green-800 mb-2 sticky top-0 bg-[#fafffa] py-1">
              {TIER_LABEL[tier]}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {items.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm cursor-pointer border transition ${
                    isSelected(opt)
                      ? 'border-green-500 bg-green-50 text-green-900'
                      : 'border-transparent hover:bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected(opt)}
                    onChange={() => toggle(opt)}
                    className="rounded border-green-300 text-green-600"
                  />
                  <span className="leading-tight">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {filteredAtendimento.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-green-800 mb-2">
              {TIER_LABEL.outro}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {filteredAtendimento.map((opt) => {
                const marcado =
                  opt.id === 'outro' ? outroAtivo : isSelected(opt);
                return (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm cursor-pointer border transition ${
                      marcado
                        ? 'border-green-500 bg-green-50 text-green-900'
                        : 'border-transparent hover:bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => toggle(opt)}
                      className="rounded border-green-300 text-green-600"
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {groups.length === 0 && filteredAtendimento.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">Nenhum convênio encontrado.</p>
        )}
      </div>

      {outroAtivo && (
        <div className="rounded-xl border border-green-300 bg-green-50 p-4 space-y-2">
          <label className="block text-sm font-medium text-green-900">
            Nome do outro convênio
            <span className="text-red-500"> *</span>
          </label>
          <input
            type="text"
            value={outroTexto}
            onChange={(e) => setOutroTexto(e.target.value)}
            placeholder="Ex.: Convênio empresarial XYZ, plano local..."
            className="w-full rounded-lg border border-green-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            autoFocus
          />
          <p className="text-xs text-green-800">
            Este nome será salvo junto aos demais convênios selecionados.
          </p>
        </div>
      )}
    </div>
  );
}
