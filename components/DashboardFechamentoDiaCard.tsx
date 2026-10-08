'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, Lock, MessageCircle, Wallet } from 'lucide-react';
import ModoSalaoPinModal from '@/components/ModoSalaoPinModal';
import {
  FINANCEIRO_UPDATED_EVENT,
  revalidateFinanceiroCache,
  type FinanceiroTransacao,
} from '@/lib/financeiroCache';
import {
  mensagemRepasseProfissional,
  periodoRepasse,
  relatorioRepasseProfissionais,
} from '@/lib/financeiroRepasse';
import { formatCurrency } from '@/lib/constants';
import { useMedicosOptions } from '@/lib/useMedicosOptions';
import { buildWhatsAppUrls } from '@/lib/whatsapp';
import { openWhatsAppUrl } from '@/lib/openExternalUrl';

type PinStatus = { enabled: boolean; hasPin: boolean; locked: boolean; unlocked: boolean };

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'bloqueado'; pinLocked: boolean }
  | { tipo: 'erro' }
  | { tipo: 'ok'; transacoes: FinanceiroTransacao[] };

/** Fechamento do dia por profissional (repasse diário). Respeita o PIN do modo salão. */
export default function DashboardFechamentoDiaCard({ userEmail }: { userEmail: string }) {
  const { isClinica, loading: loadingEquipe } = useMedicosOptions();
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [pinOpen, setPinOpen] = useState(false);

  const carregar = useCallback(
    async (force = false) => {
      if (!userEmail) return;
      try {
        const res = await fetch('/api/financeiro/unlock', { cache: 'no-store' });
        if (res.ok) {
          const pin = (await res.json()) as PinStatus;
          if (pin.enabled && pin.hasPin && !pin.unlocked) {
            setEstado({ tipo: 'bloqueado', pinLocked: pin.locked });
            return;
          }
        }
        const hoje = periodoRepasse('hoje');
        const transacoes = await revalidateFinanceiroCache(
          userEmail,
          { start: hoje.start, end: hoje.end, type: 'entrada' },
          { force },
        );
        setEstado({ tipo: 'ok', transacoes });
      } catch {
        setEstado({ tipo: 'erro' });
      }
    },
    [userEmail],
  );

  useEffect(() => {
    if (!isClinica) return;
    void carregar();
    const onUpdated = () => void carregar(true);
    window.addEventListener(FINANCEIRO_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(FINANCEIRO_UPDATED_EVENT, onUpdated);
  }, [isClinica, carregar]);

  const linhas = useMemo(
    () => (estado.tipo === 'ok' ? relatorioRepasseProfissionais(estado.transacoes) : []),
    [estado],
  );
  const totais = useMemo(
    () =>
      linhas.reduce(
        (acc, r) => ({
          bruto: acc.bruto + r.bruto,
          profissional: acc.profissional + r.profissional,
          salao: acc.salao + r.salao,
        }),
        { bruto: 0, profissional: 0, salao: 0 },
      ),
    [linhas],
  );

  if (loadingEquipe || !isClinica) return null;

  const descricaoHoje = periodoRepasse('hoje').descricao;

  return (
    <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 sm:text-lg">
          <Wallet className="h-4 w-4 text-[#047482]" />
          Fechamento do dia
        </h2>
        <Link
          href="/financeiro?view=repasse&periodo=semana"
          className="flex items-center gap-1 text-sm font-medium text-[#047482]"
        >
          Semana e mês <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {estado.tipo === 'carregando' && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-[#047482]" />
        </div>
      )}

      {estado.tipo === 'erro' && (
        <p className="py-2 text-sm text-gray-500">
          Não foi possível carregar o fechamento agora.{' '}
          <button
            type="button"
            onClick={() => void carregar(true)}
            className="font-semibold text-[#047482]"
          >
            Tentar de novo
          </button>
        </p>
      )}

      {estado.tipo === 'bloqueado' && (
        <div className="flex flex-col items-start gap-2 py-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <Lock className="h-4 w-4 text-gray-400" />
            Valores protegidos pelo PIN do modo salão.
          </p>
          <button
            type="button"
            onClick={() => setPinOpen(true)}
            className="rounded-xl border border-[#047482]/30 px-3 py-1.5 text-sm font-semibold text-[#047482]"
          >
            Ver valores
          </button>
          <ModoSalaoPinModal
            open={pinOpen}
            locked={estado.pinLocked}
            title="PIN — fechamento do dia"
            onClose={() => setPinOpen(false)}
            onUnlocked={() => {
              setPinOpen(false);
              setEstado({ tipo: 'carregando' });
              void carregar(true);
            }}
          />
        </div>
      )}

      {estado.tipo === 'ok' && linhas.length === 0 && (
        <p className="py-2 text-sm text-gray-500">
          Nenhum atendimento finalizado hoje ainda. Ao finalizar uma sessão, o repasse de cada
          profissional aparece aqui.
        </p>
      )}

      {estado.tipo === 'ok' && linhas.length > 0 && (
        <>
          <ul className="divide-y divide-gray-50">
            {linhas.map((r) => (
              <li key={r.nome} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{r.nome}</p>
                  <p className="text-xs text-gray-500">
                    {r.qtd === 1 ? '1 atendimento' : `${r.qtd} atendimentos`} ·{' '}
                    {formatCurrency(r.bruto)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400">Pagar</p>
                    <p className="text-sm font-bold text-emerald-600">
                      {formatCurrency(r.profissional)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Enviar resumo do dia para ${r.nome}`}
                    onClick={() => {
                      const urls = buildWhatsAppUrls(
                        null,
                        mensagemRepasseProfissional(r, descricaoHoje),
                      );
                      openWhatsAppUrl(urls.web, { appUrl: urls.app, androidUrl: urls.android });
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[#eef4f5] p-3 text-center">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Atendido</p>
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(totais.bruto)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Profissionais</p>
              <p className="text-sm font-semibold text-emerald-600">
                {formatCurrency(totais.profissional)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Salão</p>
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(totais.salao)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
