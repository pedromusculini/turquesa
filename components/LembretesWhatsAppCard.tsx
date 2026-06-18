'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import { tituloDiasAntes } from '@/lib/lembretesCopy';
import { isMobileDevice, openWhatsAppUrl } from '@/lib/openExternalUrl';

type LembreteItem = {
  id: string;
  paciente: string;
  data: string;
  hora: string;
  medico: string | null;
  mensagem: string;
  enviado?: boolean;
  whatsapp_url: string | null;
  whatsapp_app_url?: string | null;
  whatsapp_android_url?: string | null;
};

type LembretesSettings = {
  lembrete_antecedencia_ativo: boolean;
  lembrete_antecedencia_dias: number;
  lembrete_1_dia_ativo: boolean;
};

const DEFAULT_SETTINGS: LembretesSettings = {
  lembrete_antecedencia_ativo: true,
  lembrete_antecedencia_dias: 7,
  lembrete_1_dia_ativo: true,
};

export default function LembretesWhatsAppCard() {
  const [lembretes7, setLembretes7] = useState<LembreteItem[]>([]);
  const [lembretes1, setLembretes1] = useState<LembreteItem[]>([]);
  const [settings, setSettings] = useState<LembretesSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/lembretes/pendentes')
      .then((r) => r.json())
      .then((d) => {
        setLembretes7(d.lembretes7 || []);
        setLembretes1(d.lembretes1 || []);
        setSettings(d.settings ?? DEFAULT_SETTINGS);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) load();
    };

    let cancelDefer: (() => void) | undefined;
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 2000 });
      cancelDefer = () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    } else {
      const id = setTimeout(run, 800);
      cancelDefer = () => {
        cancelled = true;
        clearTimeout(id);
      };
    }

    return cancelDefer;
  }, [load]);

  function setEnviadoLocal(id: string, tipo: 'd7' | 'd1') {
    const setter = tipo === 'd7' ? setLembretes7 : setLembretes1;
    setter((prev) => prev.map((item) => (item.id === id ? { ...item, enviado: true } : item)));
  }

  async function marcarEnviado(id: string, tipo: 'd7' | 'd1') {
    setEnviadoLocal(id, tipo);
    const url = `/api/lembretes/${id}/marcar-enviado`;
    const body = JSON.stringify({ tipo });
    if (typeof navigator !== 'undefined' && isMobileDevice() && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      return;
    }
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
    } catch {
      // Página pode descarregar ao abrir WhatsApp no mobile.
    }
  }

  async function marcarRemovido(id: string, tipo: 'd7' | 'd1') {
    await fetch(`/api/lembretes/${id}/marcar-removido`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo }),
    });
    load();
  }

  function copiar(id: string, texto: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 2000);
  }

  function Lista({
    titulo,
    items,
    tipo,
  }: {
    titulo: string;
    items: LembreteItem[];
    tipo: 'd7' | 'd1';
  }) {
    if (items.length === 0) return null;
    return (
      <div className="mt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">{titulo}</h3>
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={`${tipo}-${item.id}`}
              className="p-4 rounded-xl border border-gray-100 bg-[#f8f9fa] flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{item.paciente}</p>
                <p className="text-sm text-gray-500">
                  {item.data} às {item.hora}
                  {item.medico ? ` · ${item.medico}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {item.whatsapp_url && (
                  <button
                    type="button"
                    onClick={() => {
                      void marcarEnviado(item.id, tipo);
                      openWhatsAppUrl(item.whatsapp_url!, {
                        appUrl: item.whatsapp_app_url ?? undefined,
                        androidUrl: item.whatsapp_android_url ?? undefined,
                      });
                    }}
                    className={
                      item.enviado
                        ? 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#047482] hover:bg-[#035a66] text-white text-xs font-semibold'
                        : 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#25D366] hover:bg-[#1da851] text-white text-xs font-semibold'
                    }
                  >
                    <MessageCircle className="w-4 h-4" />
                    {item.enviado ? 'Aberto' : 'WhatsApp'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => copiar(item.id, item.mensagem)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-white"
                >
                  {copiado === item.id ? (
                    <Check className="w-4 h-4 text-[#047482]" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  Copiar
                </button>
                <button
                  type="button"
                  onClick={() => void marcarRemovido(item.id, tipo)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-500 hover:bg-white hover:text-gray-700"
                  title="Remover da lista"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-[#eef4f5]">
            <Bell className="w-5 h-5 text-[#047482]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Lembretes WhatsApp</h2>
            <p className="text-sm text-gray-500">
              Envie pelo seu WhatsApp Business — mensagens personalizadas em{' '}
              <Link href="/dashboard/configuracoes" className="text-[#047482] font-medium">
                Configurações
              </Link>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          className="text-sm text-[#047482] font-medium self-start sm:self-center"
        >
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-[#047482]" />
        </div>
      ) : lembretes7.length === 0 && lembretes1.length === 0 ? (
        <p className="text-sm text-gray-500 mt-4 py-6 text-center">
          Nenhum lembrete pendente para hoje. Atendimentos com WhatsApp preenchido e lembrete ativo
          (agenda ou avulso) aparecem aqui nos prazos definidos em{' '}
          <Link href="/dashboard/configuracoes" className="text-[#047482] font-medium">
            Configurações
          </Link>
          — prazos conforme Configurações (dias de antecedência e lembrete de véspera, se ativo).
        </p>
      ) : (
        <>
          {settings.lembrete_antecedencia_ativo && (
            <Lista
              titulo={tituloDiasAntes(settings.lembrete_antecedencia_dias)}
              items={lembretes7}
              tipo="d7"
            />
          )}
          {settings.lembrete_1_dia_ativo && (
            <Lista titulo="1 dia antes" items={lembretes1} tipo="d1" />
          )}
        </>
      )}

      <p className="text-xs text-gray-400 mt-4 flex items-center gap-1">
        <ExternalLink className="w-3 h-3" />
        Ao abrir o WhatsApp, confirme o envio no seu celular.
      </p>
    </section>
  );
}
