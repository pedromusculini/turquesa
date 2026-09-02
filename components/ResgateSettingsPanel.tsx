'use client';

import { useEffect, useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import { parseDiasInputString } from '@/lib/lembretesSettings';
import { clampResgateDiasLimite, type ResgateWhatsappSettings } from '@/lib/resgateSettings';

type Props = {
  value: ResgateWhatsappSettings;
  onChange: (v: ResgateWhatsappSettings) => void;
};

export default function ResgateSettingsPanel({ value, onChange }: Props) {
  const [diasInput, setDiasInput] = useState(String(value.resgate_dias_limite));

  useEffect(() => {
    setDiasInput(String(value.resgate_dias_limite));
  }, [value.resgate_dias_limite]);

  function commitDias(raw: string) {
    const dias = clampResgateDiasLimite(parseDiasInputString(raw) || 30);
    setDiasInput(String(dias));
    onChange({ ...value, resgate_dias_limite: dias });
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl bg-amber-50 p-2">
          <HeartHandshake className="h-5 w-5 text-amber-700" aria-hidden />
        </div>
        <div>
          <h2 className="font-bold text-gray-900">Resgate de clientes (Dashboard)</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Lista no Dashboard clientes com sessão realizada há muito tempo — envio manual pelo
            WhatsApp, com a mensagem &quot;Resgate de cliente&quot; abaixo.
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 p-4 hover:bg-gray-50/80">
        <input
          type="checkbox"
          checked={value.resgate_cliente_ativo}
          onChange={(e) => onChange({ ...value, resgate_cliente_ativo: e.target.checked })}
          className="mt-1 rounded border-gray-300 text-[#047482] focus:ring-[#047482]"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-gray-900">
            Ativar fila de resgate no Dashboard
          </span>
          <span className="mt-0.5 block text-xs text-gray-500">
            Quando ligado, aparece um card com clientes elegíveis para mensagem de retorno.
          </span>
          {value.resgate_cliente_ativo && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-700">Considerar sem retorno após</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                value={diasInput}
                onChange={(e) => setDiasInput(e.target.value.replace(/\D/g, '').slice(0, 3))}
                onBlur={() => commitDias(diasInput)}
                className="w-16 rounded-lg border border-gray-200 px-3 py-2 text-center text-sm font-medium"
                aria-label="Dias sem retorno para resgate"
              />
              <span className="text-sm text-gray-700">dias da última sessão realizada</span>
            </div>
          )}
        </span>
      </label>
    </section>
  );
}
