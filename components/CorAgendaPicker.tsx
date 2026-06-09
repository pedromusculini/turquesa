'use client';

import {
  AGENDA_COR_PRESETS,
  colorsFromCorAgenda,
  normalizeCorAgenda,
} from '@/lib/agendaProfissionalColors';

type CorAgendaPickerProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
};

export default function CorAgendaPicker({ value, onChange, error }: CorAgendaPickerProps) {
  const preview = value ? colorsFromCorAgenda(value) : null;

  function handleHexInput(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange(null);
      return;
    }
    const normalized = normalizeCorAgenda(trimmed);
    onChange(normalized);
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">Cor na agenda</label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          title="Automática"
          onClick={() => onChange(null)}
          className={`h-9 w-9 rounded-lg border-2 bg-gradient-to-br from-slate-100 to-slate-200 ${
            value == null ? 'border-[#047482] ring-2 ring-[#047482]/30' : 'border-gray-200'
          }`}
          aria-label="Cor automática"
        />
        {AGENDA_COR_PRESETS.map((preset) => {
          const selected = value?.toLowerCase() === preset.border.toLowerCase();
          return (
            <button
              key={preset.border}
              type="button"
              title={preset.border}
              onClick={() => onChange(preset.border)}
              className={`h-9 w-9 rounded-lg border-2 ${
                selected ? 'ring-2 ring-[#047482]/30' : ''
              }`}
              style={{
                backgroundColor: preset.background,
                borderColor: selected ? '#047482' : preset.border,
              }}
              aria-label={`Cor ${preset.border}`}
            />
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <input
          type="color"
          value={value ?? '#047482'}
          onChange={(e) => onChange(normalizeCorAgenda(e.target.value))}
          className="h-10 w-14 cursor-pointer rounded-lg border border-gray-200 bg-white p-1"
          aria-label="Seletor de cor personalizada"
        />
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => handleHexInput(e.target.value)}
          placeholder="#047482"
          className={`flex-1 rounded-xl border px-3 py-2 text-sm font-mono uppercase ${
            error ? 'border-red-400 bg-red-50' : 'border-gray-200'
          }`}
          maxLength={7}
        />
        {preview && (
          <span
            className="inline-flex h-10 min-w-[4.5rem] shrink-0 items-center justify-center rounded-xl border-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-700"
            style={{
              backgroundColor: preview.background,
              borderColor: preview.border,
            }}
          >
            Preview
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <p className="mt-1 text-xs text-gray-500">
        Define a cor dos agendamentos desta profissional no calendário. Deixe em branco para cor
        automática.
      </p>
    </div>
  );
}
