'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Calendar, Download, Loader2, MapPin, Stethoscope } from 'lucide-react';
import Link from 'next/link';

type CalData = {
  paciente: string;
  medico: string | null;
  servico: string;
  local: string;
  clinica: string;
  data: string;
  hora: string;
  google_url: string;
  ics_url: string;
};

export default function CalendarioAdicionarPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<CalData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/calendario/adicionar/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErro(d.error);
        else setData(d);
      })
      .catch(() => setErro('Não foi possível carregar o evento'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <Loader2 className="w-8 h-8 animate-spin text-[#228B22]" />
      </div>
    );
  }

  if (erro || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] p-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center max-w-md">
          <p className="text-red-600">{erro || 'Link inválido'}</p>
          <Link href="/" className="mt-4 inline-block text-sm text-[#228B22] font-medium">
            Voltar ao site
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f4fff4] to-[#f8f9fa] px-4 py-10">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#90EE90]/40 mb-3">
            <Calendar className="w-7 h-7 text-[#228B22]" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Adicionar à sua agenda</h1>
          <p className="text-sm text-gray-500 mt-1">{data.clinica}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Consulta</p>
            <p className="font-semibold text-gray-900">{data.servico}</p>
          </div>
          <div className="flex items-start gap-3">
            <Stethoscope className="w-5 h-5 text-[#228B22] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-gray-500">Profissional</p>
              <p className="font-medium text-gray-900">{data.medico || 'A confirmar'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-[#228B22] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-gray-500">Data e hora</p>
              <p className="font-medium text-gray-900">
                {data.data} às {data.hora}
              </p>
            </div>
          </div>
          {data.local && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#228B22] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Local</p>
                <p className="font-medium text-gray-900 text-sm leading-snug">{data.local}</p>
              </div>
            </div>
          )}

          <div className="pt-2 space-y-3">
            <a
              href={data.google_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[#013a01] hover:bg-[#025201] text-white font-semibold text-sm transition-colors"
            >
              <Calendar className="w-5 h-5" />
              Google Calendar
            </a>
            <a
              href={`/api/calendario/adicionar/${token}?format=ics`}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl border-2 border-[#228B22] text-[#228B22] font-semibold text-sm hover:bg-[#f4fff4] transition-colors"
            >
              <Download className="w-5 h-5" />
              Apple / Outlook (.ics)
            </a>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Toque em Salvar no app de calendário após abrir o link.
          </p>
        </div>
      </div>
    </div>
  );
}
