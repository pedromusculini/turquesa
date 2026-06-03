'use client';

import {
  PLANOS_SAUDE_ATENDIMENTO,
  PLANOS_SAUDE_OPERADORAS,
  PLANO_SAUDE_OUTRO,
  TIER_LABEL,
  formatarOutroConvenio,
  isOutroConvenioSalvo,
  textoOutroConvenio,
} from '@/lib/planosSaude';

type ConvenioSelectProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
};

export default function ConvenioSelect({
  value,
  onChange,
  label = 'Convênio / plano de saúde',
  required = false,
  className = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm',
  allowEmpty = true,
  emptyLabel = 'Selecione...',
}: ConvenioSelectProps) {
  const isOutro = isOutroConvenioSalvo(value);
  const outroTexto = isOutro ? textoOutroConvenio(value) || '' : '';
  const selectValue = isOutro ? PLANO_SAUDE_OUTRO.label : value;

  function handleSelectChange(next: string) {
    if (next === PLANO_SAUDE_OUTRO.label) {
      onChange(PLANO_SAUDE_OUTRO.label);
    } else {
      onChange(next);
    }
  }

  function handleOutroTextChange(text: string) {
    const formatted = formatarOutroConvenio(text);
    onChange(formatted || PLANO_SAUDE_OUTRO.label);
  }

  return (
    <div className="space-y-2">
      <label className="block space-y-1">
        {label && (
          <span className="text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500"> *</span>}
          </span>
        )}
        <select
          value={selectValue}
          onChange={(e) => handleSelectChange(e.target.value)}
          required={required && !isOutro}
          className={className}
        >
          {allowEmpty && <option value="">{emptyLabel}</option>}
          <optgroup label={TIER_LABEL.lider}>
            {PLANOS_SAUDE_OPERADORAS.filter((p) => p.tier === 'lider').map((p) => (
              <option key={p.id} value={p.label}>
                {p.label}
              </option>
            ))}
          </optgroup>
          <optgroup label={TIER_LABEL.grande}>
            {PLANOS_SAUDE_OPERADORAS.filter((p) => p.tier === 'grande').map((p) => (
              <option key={p.id} value={p.label}>
                {p.label}
              </option>
            ))}
          </optgroup>
          <optgroup label={TIER_LABEL.medio}>
            {PLANOS_SAUDE_OPERADORAS.filter((p) => p.tier === 'medio').map((p) => (
              <option key={p.id} value={p.label}>
                {p.label}
              </option>
            ))}
          </optgroup>
          <optgroup label={TIER_LABEL.regional}>
            {PLANOS_SAUDE_OPERADORAS.filter((p) => p.tier === 'regional').map((p) => (
              <option key={p.id} value={p.label}>
                {p.label}
              </option>
            ))}
          </optgroup>
          <optgroup label={TIER_LABEL.outro}>
            {PLANOS_SAUDE_ATENDIMENTO.map((p) => (
              <option key={p.id} value={p.label}>
                {p.label}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      {isOutro && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
          <label className="block text-sm font-medium text-green-900">
            Qual convênio?
            <span className="text-red-500"> *</span>
          </label>
          <input
            type="text"
            value={outroTexto}
            onChange={(e) => handleOutroTextChange(e.target.value)}
            placeholder="Digite o nome do convênio"
            required={required}
            className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
