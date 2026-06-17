'use client';

import Link from 'next/link';

type MedicoSelectProps = {
  medicos: string[];
  value: string;
  onChange: (value: string) => void;
  isClinica?: boolean;
  required?: boolean;
  error?: string;
  label?: string;
  className?: string;
  emptyOptionLabel?: string;
  /** Exige escolha explícita mesmo com uma única profissional na lista. */
  requireExplicitPick?: boolean;
};

export default function MedicoSelect({
  medicos,
  value,
  onChange,
  isClinica = false,
  required = true,
  error,
  label = 'Profissional',
  className = 'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm bg-white',
  emptyOptionLabel = 'Selecione a profissional',
  requireExplicitPick = false,
}: MedicoSelectProps) {
  if (isClinica && medicos.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">Nenhuma profissional cadastrada</p>
        <p className="mt-1 text-xs text-amber-800">
          Cadastre profissionais (ilimitados no plano) em{' '}
          <Link href="/dashboard/configuracoes/equipe" className="font-semibold underline">
            Configurações → Equipe
          </Link>{' '}
          antes de agendar.
        </p>
      </div>
    );
  }

  if (medicos.length === 0) {
    return null;
  }

  const showEmptyOption = requireExplicitPick || medicos.length > 1;
  const showRequired = required && showEmptyOption;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {showRequired ? ' *' : ''}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={showRequired}
        className={`${className} ${error ? 'border-red-400 bg-red-50' : ''}`}
      >
        {showEmptyOption && <option value="">{emptyOptionLabel}</option>}
        {medicos.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
