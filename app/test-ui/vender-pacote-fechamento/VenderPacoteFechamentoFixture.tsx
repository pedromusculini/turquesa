'use client';

import { useEffect, useState } from 'react';
import FinalizarConsultaModal from '@/components/FinalizarConsultaModal';
import type { ConsultationRecord } from '@/lib/consultations';
import { saveCookieConsent } from '@/lib/cookieConsent';

const MOCK: ConsultationRecord = {
  id: 'fixture-consulta-1',
  patient: 'Maria Silva',
  start: new Date().toISOString(),
  end: new Date(Date.now() + 3600000).toISOString(),
  status: 'agendado',
  value: 120,
  service: 'Depilação',
  medico: 'Ana',
  clienteDriveId: 'fixture-cliente-drive',
  observacoes: '',
};

export default function VenderPacoteFechamentoFixture() {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastPayload, setLastPayload] = useState<string>('');

  useEffect(() => {
    saveCookieConsent();
    setReady(true);
    setOpen(true);
  }, []);

  if (!ready) {
    return <div className="min-h-screen bg-slate-100 p-6 text-sm text-gray-600">Carregando…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <h1 className="text-lg font-semibold text-gray-900">
        Fixture: vender pacote no fechamento
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Abra o modal e escolha “Vender pacote agora” para validar o fluxo.
      </p>
      <button
        type="button"
        className="mt-4 rounded-xl bg-[#047482] px-4 py-2 text-sm font-semibold text-white"
        onClick={() => setOpen(true)}
      >
        Abrir finalizar atendimento
      </button>
      {lastPayload && (
        <pre className="mt-4 overflow-auto rounded-xl bg-white p-3 text-xs text-gray-700">
          {lastPayload}
        </pre>
      )}
      {open && (
        <FinalizarConsultaModal
          consulta={MOCK}
          medicos={['Ana', 'Bia']}
          isClinica
          initialCobrarModo="vender_pacote"
          venderPacoteInitialValues={{
            nome: '10 sessões de depilação',
            sessoes: '10',
            sessoesJaUsadas: '2',
            valor: '500,00',
          }}
          onClose={() => setOpen(false)}
          onConfirm={(payload) => {
            setLastPayload(JSON.stringify(payload, null, 2));
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
