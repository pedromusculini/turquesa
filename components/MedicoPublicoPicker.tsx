'use client';

import { useEffect } from 'react';
import type { MedicoPublico } from '@/lib/medicosPublicos';
import { medicoPublicoSubtitle } from '@/lib/medicosPublicos';

type MedicoPublicoPickerProps = {
  medicos: MedicoPublico[];
  isClinica?: boolean;
  value: string;
  onChange: (nome: string) => void;
  error?: string;
  title?: string;
  hint?: string;
};

export default function MedicoPublicoPicker({
  medicos,
  isClinica = false,
  value,
  onChange,
  error,
  title = 'Profissional',
  hint,
}: MedicoPublicoPickerProps) {
  useEffect(() => {
    if (medicos.length === 1 && value !== medicos[0].nome) {
      onChange(medicos[0].nome);
    }
  }, [medicos, value, onChange]);

  if (isClinica && medicos.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">Nenhum médico disponível no momento</p>
        <p className="mt-1 text-xs text-amber-800">
          A clínica ainda não cadastrou a equipe. Entre em contato por WhatsApp.
        </p>
      </div>
    );
  }

  if (medicos.length === 0) return null;

  const escolha = medicos.length > 1;

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">
          {title}
          {escolha ? ' *' : ''}
        </h3>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
        {!hint && escolha && (
          <p className="text-xs text-gray-500 mt-0.5">Escolha com quem deseja ser atendido</p>
        )}
      </div>
      <div className="space-y-2">
        {medicos.map((m) => {
          const subtitle = medicoPublicoSubtitle(m);
          const selected = value === m.nome;
          return (
            <button
              key={m.nome}
              type="button"
              onClick={() => escolha && onChange(m.nome)}
              disabled={!escolha}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors ${
                selected
                  ? 'border-[#228B22] bg-[#f4fff4]'
                  : escolha
                    ? 'border-gray-100 hover:border-[#90EE90]'
                    : 'border-gray-100 bg-gray-50'
              } ${!escolha ? 'cursor-default' : ''}`}
            >
              <span className="font-medium text-gray-900 block">{m.nome}</span>
              {subtitle ? (
                <span className="text-xs text-gray-600 mt-0.5 block">{subtitle}</span>
              ) : (
                <span className="text-xs text-gray-400 mt-0.5 block">
                  Dados profissionais não informados
                </span>
              )}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
