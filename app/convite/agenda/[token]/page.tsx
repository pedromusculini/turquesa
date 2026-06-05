'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Calendar, CheckCircle2, Loader2, Shield } from 'lucide-react';
import Link from 'next/link';

type InviteInfo = {
  nomeProfissional: string;
  nomeSalao: string;
  alreadyConnected: boolean;
  inviteExpired: boolean;
  inviteValid: boolean;
};

export default function ConviteAgendaPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const erroParam = searchParams.get('erro');
  const conectado = searchParams.get('conectado') === '1';

  useEffect(() => {
    fetch(`/api/convite/agenda/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setLoadError(data.error);
        else setInfo(data);
      })
      .catch(() => setLoadError('Não foi possível carregar o convite'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Loader2 className="h-8 w-8 animate-spin text-[#047482]" />
      </div>
    );
  }

  if (loadError || !info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-red-700">{loadError || 'Convite não encontrado'}</p>
        </div>
      </div>
    );
  }

  const showSuccess = conectado || info.alreadyConnected;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-[#047482]/10 p-3">
            <Calendar className="h-6 w-6 text-[#047482]" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Turquesa Agenda
            </p>
            <h1 className="text-xl font-semibold text-slate-900">Acesso à agenda Google</h1>
          </div>
        </div>

        {showSuccess ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <p className="text-lg font-medium text-slate-900">Agenda conectada!</p>
            <p className="text-sm text-slate-600">
              {info.nomeSalao} agora pode ver e gerenciar sua agenda Google no Turquesa Agenda.
              Você autorizou somente o Google Calendar — nenhum outro dado foi compartilhado.
            </p>
          </div>
        ) : info.inviteExpired ? (
          <div className="space-y-4">
            <p className="text-sm text-amber-800">
              Este convite expirou. Peça ao salão um novo link pelo WhatsApp.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-slate-700">
              Olá, <strong>{info.nomeProfissional}</strong>! O salão{' '}
              <strong>{info.nomeSalao}</strong> usa o Turquesa Agenda para organizar as sessões.
            </p>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="mb-2 font-medium text-slate-800">O que será compartilhado</p>
              <ul className="list-inside list-disc space-y-1">
                <li>Somente sua agenda Google (criar, editar e ver eventos)</li>
                <li>Não inclui e-mails, Drive, fotos nem outros dados</li>
              </ul>
            </div>

            <div className="flex items-start gap-2 text-xs text-slate-500">
              <Shield className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Você será redirecionada ao Google para autorizar. Pode revogar o acesso a qualquer
                momento em myaccount.google.com/permissions.
              </span>
            </div>

            {erroParam && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erroParam}</p>
            )}

            <a
              href={`/api/auth/profissional-google-authorize?token=${encodeURIComponent(token)}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#047482] px-4 py-3 text-sm font-semibold text-white hover:bg-[#035e6b]"
            >
              <Calendar className="h-4 w-4" />
              Autorizar agenda Google
            </a>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          <Link href="/" className="hover:text-slate-600">
            turquesaagenda.com.br
          </Link>
        </p>
      </div>
    </div>
  );
}
