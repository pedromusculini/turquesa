'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { tituloDiasAntes, type LembretesSettingsUi } from '@/lib/lembretesCopy';
import { parseDiasInputString } from '@/lib/lembretesSettings';

type Props = {
  value: LembretesSettingsUi;
  onChange: (v: LembretesSettingsUi) => void;
};

export default function LembretesSettingsPanel({ value, onChange }: Props) {
  const [diasInput, setDiasInput] = useState(String(value.lembrete_antecedencia_dias));

  useEffect(() => {
    setDiasInput(String(value.lembrete_antecedencia_dias));
  }, [value.lembrete_antecedencia_dias]);

  function commitDias(raw: string) {
    const dias = parseDiasInputString(raw);
    setDiasInput(String(dias));
    onChange({ ...value, lembrete_antecedencia_dias: dias });
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-xl bg-[#eef4f5]">
          <Bell className="w-5 h-5 text-[#047482]" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900">Prazos dos lembretes (Dashboard)</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Define quando as sessões aparecem no card de lembretes do Dashboard. O envio continua
            manual pelo WhatsApp.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-gray-100 p-4 hover:bg-gray-50/80">
          <input
            type="checkbox"
            checked={value.lembrete_antecedencia_ativo}
            onChange={(e) =>
              onChange({ ...value, lembrete_antecedencia_ativo: e.target.checked })
            }
            className="mt-1 rounded border-gray-300 text-[#047482] focus:ring-[#047482]"
          />
          <span className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-gray-900 block">
              Lembrete com antecedência
            </span>
            <span className="text-xs text-gray-500 block mt-0.5">
              Lista sessões no Dashboard com a antecedência abaixo (0 = no dia da sessão).
            </span>
            {value.lembrete_antecedencia_ativo && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-700">Enviar</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  value={diasInput}
                  onChange={(e) => setDiasInput(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  onBlur={() => commitDias(diasInput)}
                  className="w-16 px-3 py-2 rounded-lg border border-gray-200 text-sm text-center font-medium"
                  aria-label="Dias de antecedência do lembrete"
                />
                <span className="text-sm text-gray-700">
                  {value.lembrete_antecedencia_dias === 1 ? 'dia antes' : 'dias antes'} da sessão
                </span>
                <span className="text-xs text-gray-400 w-full sm:w-auto">
                  ({tituloDiasAntes(value.lembrete_antecedencia_dias)})
                </span>
              </div>
            )}
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-gray-100 p-4 hover:bg-gray-50/80">
          <input
            type="checkbox"
            checked={value.lembrete_1_dia_ativo}
            onChange={(e) => onChange({ ...value, lembrete_1_dia_ativo: e.target.checked })}
            className="mt-1 rounded border-gray-300 text-[#047482] focus:ring-[#047482]"
          />
          <span className="text-sm text-gray-700">
            <strong className="text-gray-900 block">Lembrete 1 dia antes</strong>
            <span className="text-xs text-gray-500 mt-0.5 block">
              Segundo aviso no Dashboard na véspera da sessão (independente da antecedência acima).
            </span>
          </span>
        </label>
      </div>
    </section>
  );
}
