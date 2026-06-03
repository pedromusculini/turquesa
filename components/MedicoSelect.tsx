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
};

export default function MedicoSelect({
  medicos,
  value,
  onChange,
  isClinica = false,
  required = true,
  error,
  label = 'Médico',
  className = 'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm bg-white',
  emptyOptionLabel = 'Selecione o médico',
}: MedicoSelectProps) {
  if (isClinica && medicos.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">Nenhum médico cadastrado na clínica</p>
        <p className="mt-1 text-xs text-amber-800">
          Cadastre a equipe em{' '}
          <Link href="/dashboard/perfil" className="font-semibold underline">
            Meu Perfil → Médicos da Clínica
          </Link>{' '}
          antes de agendar.
        </p>
      </div>
    );
  }

  if (medicos.length === 0) {
    return null;
  }

  const showRequired = required && medicos.length > 1;

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
        {medicos.length > 1 && <option value="">{emptyOptionLabel}</option>}
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
