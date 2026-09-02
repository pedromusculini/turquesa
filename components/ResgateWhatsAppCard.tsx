'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Copy,
  HeartHandshake,
  Loader2,
  MessageCircle,
  Settings,
} from 'lucide-react';
import { isMobileDevice, openWhatsAppUrl } from '@/lib/openExternalUrl';

type ResgateItem = {
  id: string;
  nome: string;
  telefone: string;
  dias_sem_retorno: number;
  ultima_sessao: string;
  mensagem: string;
  enviado?: boolean;
  whatsapp_url: string | null;
  whatsapp_app_url?: string | null;
  whatsapp_android_url?: string | null;
};

export default function ResgateWhatsAppCard() {
  const [ativo, setAtivo] = useState(false);
  const [diasLimite, setDiasLimite] = useState(30);
  const [items, setItems] = useState<ResgateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch('/api/resgate/pendentes');
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'DRIVE_NOT_CONNECTED') setDriveError(data.error);
        return;
      }
      setDriveError(null);
      setAtivo(data.ativo === true);
      setDiasLimite(typeof data.dias_limite === 'number' ? data.dias_limite : 30);
      setItems(Array.isArray(data.resgates) ? data.resgates : []);
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (loading) return null;
  if (driveError || !ativo) return null;

  const pendentes = items.filter((i) => !i.enviado);

  async function marcarEnviado(id: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, enviado: true } : i)));
    try {
      await fetch(`/api/resgate/${id}/marcar-enviado`, { method: 'POST' });
    } catch {
      /* ok */
    }
  }

  async function marcarRemovido(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/resgate/${id}/marcar-removido`, { method: 'POST' });
  }

  function copiar(id: string, texto: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 2000);
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-amber-950">
            <HeartHandshake className="h-5 w-5 text-amber-700" aria-hidden />
            Resgate de clientes
          </h2>
          <p className="mt-1 text-sm text-amber-900/80">
            {pendentes.length} com +{diasLimite} dias sem sessão realizada · envio manual WhatsApp
          </p>
        </div>
        <Link
          href="/dashboard/configuracoes?tab=mensagens"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50"
        >
          <Settings className="h-4 w-4" aria-hidden />
          Mensagem e prazo
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl bg-white/80 px-4 py-6 text-center text-sm text-amber-900">
          Nenhuma cliente elegível agora — ou todas já foram contactadas.
        </p>
      ) : (
        <ul className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {items.slice(0, 50).map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 rounded-xl border border-amber-100 bg-white p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-900">{item.nome}</p>
                <p className="text-sm text-gray-500">
                  {item.dias_sem_retorno}d sem retorno · última {item.ultima_sessao}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {item.whatsapp_url && (
                  <button
                    type="button"
                    onClick={() => {
                      void marcarEnviado(item.id);
                      openWhatsAppUrl(item.whatsapp_url!, {
                        appUrl: item.whatsapp_app_url ?? undefined,
                        androidUrl: item.whatsapp_android_url ?? undefined,
                      });
                    }}
                    className={
                      item.enviado
                        ? 'inline-flex items-center gap-1.5 rounded-lg bg-[#047482] px-3 py-2 text-xs font-semibold text-white'
                        : 'inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1da851]'
                    }
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    {item.enviado ? 'Aberto' : 'WhatsApp'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => copiar(item.id, item.mensagem)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  {copiado === item.id ? (
                    <Check className="h-4 w-4 text-[#047482]" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  Copiar
                </button>
                <button
                  type="button"
                  onClick={() => void marcarRemovido(item.id)}
                  className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50"
                >
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {items.length > 50 && (
        <p className="mt-3 text-center text-xs text-amber-800">
          Mostrando 50 de {items.length}. Veja a lista completa em{' '}
          <Link href="/clientes/relatorio" className="font-semibold underline">
            Relatório de clientes
          </Link>
          .
        </p>
      )}
    </div>
  );
}
