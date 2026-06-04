'use client';

import type { AnamneseCampo } from '@/lib/anamnese';

type Props = {
  campos: AnamneseCampo[];
  values: Record<string, string | boolean>;
  onChange: (id: string, value: string | boolean) => void;
};

export default function AnamnesePublicFields({ campos, values, onChange }: Props) {
  if (campos.length === 0) return null;

  return (
    <fieldset className="space-y-4 border-t border-gray-100 pt-4">
      <legend className="text-sm font-semibold text-gray-900">Anamnese</legend>
      {campos.map((campo) => (
        <div key={campo.id}>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {campo.label}
            {campo.obrigatorio ? ' *' : ''}
          </label>
          {campo.tipo === 'texto_curto' && (
            <input
              required={campo.obrigatorio}
              value={String(values[campo.id] ?? '')}
              onChange={(e) => onChange(campo.id, e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          )}
          {campo.tipo === 'texto_longo' && (
            <textarea
              required={campo.obrigatorio}
              rows={3}
              value={String(values[campo.id] ?? '')}
              onChange={(e) => onChange(campo.id, e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          )}
          {campo.tipo === 'sim_nao' && (
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`anamnese-${campo.id}`}
                  required={campo.obrigatorio}
                  checked={values[campo.id] === true}
                  onChange={() => onChange(campo.id, true)}
                />
                Sim
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`anamnese-${campo.id}`}
                  checked={values[campo.id] === false}
                  onChange={() => onChange(campo.id, false)}
                />
                Não
              </label>
            </div>
          )}
          {campo.tipo === 'opcoes' && (
            <select
              required={campo.obrigatorio}
              value={String(values[campo.id] ?? '')}
              onChange={(e) => onChange(campo.id, e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">Selecione...</option>
              {campo.opcoes.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}
    </fieldset>
  );
}
