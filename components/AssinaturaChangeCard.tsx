'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle,
  CreditCard,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatCurrency } from '@/lib/constants';

type PlanCatalogItem = {
  id: string;
  nome: string;
  valor: number;
  periodo: string;
  medicos: string;
  descricao: string;
  user_type: 'medico' | 'clinica';
  max_medicos: number;
};

type PlanChangeImpact = {
  isSamePlan: boolean;
  isDowngrade: boolean;
  requiresDataLossAck: boolean;
  warnings: string[];
  principalMantido: string | null;
  medicosRemovidos: { count: number; nomes: string[] };
};

type AssinaturaState = {
  current_plan: string;
  user_type: string;
  medicos_cadastrados: number;
  plans: PlanCatalogItem[];
};

type Props = {
  onPlanChanged?: () => void;
};

export default function AssinaturaChangeCard({ onPlanChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<AssinaturaState | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [impact, setImpact] = useState<PlanChangeImpact | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [dataLossAck, setDataLossAck] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/perfil/assinatura');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar');
      setState(data);
      setSelectedPlan(data.current_plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar assinatura');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !state) load();
  }, [open, state, load]);

  const fetchPreview = useCallback(async (planId: string) => {
    if (!state || planId === state.current_plan) {
      setImpact(null);
      return;
    }
    setPreviewLoading(true);
    setError('');
    try {
      const res = await fetch('/api/perfil/assinatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPlan: planId, preview: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na prévia');
      setImpact(data.impact);
      setTermsAccepted(false);
      setDataLossAck(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao simular alteração');
      setImpact(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [state]);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    setSuccess('');
    fetchPreview(planId);
  };

  const handleConfirm = async () => {
    if (!state || !selectedPlan || selectedPlan === state.current_plan) return;
    if (!termsAccepted) {
      setError('Aceite os Termos de Uso e a Política de Privacidade para continuar.');
      return;
    }
    if (impact?.requiresDataLossAck && !dataLossAck) {
      setError('Confirme que entendeu a exclusão dos dados indicados no aviso.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/perfil/assinatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPlan: selectedPlan,
          termsAccepted: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao alterar plano');

      setSuccess(data.message || 'Assinatura alterada.');
      setState((prev) =>
        prev
          ? {
              ...prev,
              current_plan: data.profile?.plan ?? selectedPlan,
              user_type: data.profile?.user_type ?? prev.user_type,
            }
          : prev,
      );
      setSelectedPlan(data.profile?.plan ?? selectedPlan);
      setImpact(null);
      setTermsAccepted(false);
      setDataLossAck(false);
      onPlanChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao alterar assinatura');
    } finally {
      setSaving(false);
    }
  };

  const currentPlanInfo = state?.plans.find((p) => p.id === state.current_plan);

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#90EE90]/20">
            <CreditCard className="w-6 h-6 text-[#228B22]" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Assinatura e plano</p>
            <p className="text-sm text-gray-500">
              {loading && open
                ? 'Carregando...'
                : currentPlanInfo
                  ? `${currentPlanInfo.nome} — ${formatCurrency(currentPlanInfo.valor)}${currentPlanInfo.periodo}`
                  : 'Altere seu plano quando precisar'}
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
        )}
      </button>

      {open && (
        <div className="mt-6 pt-6 border-t border-gray-100">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando planos...
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Escolha o novo plano. Em downgrades, dados de médicos cadastrados além do
                limite podem ser removidos permanentemente — leia os avisos antes de confirmar.
                A cobrança recorrente (quando ativa) será ajustada conforme o novo plano.
              </p>

              <div className="grid gap-3 md:grid-cols-3 mb-4">
                {(state?.user_type === 'clinica'
                  ? (state?.plans ?? []).filter((p) => p.user_type === 'clinica')
                  : state?.plans ?? []
                ).map((plan) => {
                  const isCurrent = plan.id === state?.current_plan;
                  const isSelected = selectedPlan === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => handleSelectPlan(plan.id)}
                      className={`rounded-2xl border-2 p-4 text-left transition ${
                        isCurrent
                          ? 'border-gray-200 bg-gray-50 opacity-70 cursor-not-allowed'
                          : isSelected
                            ? 'border-[#228B22] bg-[#f4fff4] shadow-sm'
                            : 'border-gray-200 hover:border-[#228B22]/50'
                      }`}
                    >
                      {isCurrent && (
                        <span className="text-xs font-medium text-[#228B22] mb-1 block">
                          Plano atual
                        </span>
                      )}
                      <p className="font-semibold text-gray-900">{plan.nome}</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">
                        {formatCurrency(plan.valor)}
                        <span className="text-sm font-normal text-gray-500">{plan.periodo}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-2">{plan.medicos}</p>
                    </button>
                  );
                })}
              </div>

              {previewLoading && (
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analisando impacto da alteração...
                </div>
              )}

              {impact &&
                selectedPlan !== state?.current_plan &&
                impact.warnings.length > 0 && (
                  <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                    <div className="flex items-start gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                      <p className="font-semibold text-amber-900 text-sm">
                        {impact.isDowngrade
                          ? 'Atenção: redução de plano'
                          : 'Confirme a alteração'}
                      </p>
                    </div>
                    <ul className="space-y-2 text-sm text-amber-900 list-disc pl-5">
                      {impact.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {impact?.requiresDataLossAck &&
                selectedPlan !== state?.current_plan && (
                  <label className="flex items-start gap-3 mb-4 p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dataLossAck}
                      onChange={(e) => setDataLossAck(e.target.checked)}
                      className="mt-1 rounded border-red-300 text-red-600 focus:ring-red-400"
                    />
                    <span>
                      Entendo que esta alteração pode{' '}
                      <strong>excluir permanentemente</strong> os cadastros de médicos indicados
                      acima e que essa ação não pode ser desfeita pelo sistema. Desejo continuar.
                    </span>
                  </label>
                )}

              {selectedPlan !== state?.current_plan && (
                <label className="flex items-start gap-3 mb-4 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-1 rounded border-gray-300 text-[#228B22] focus:ring-[#228B22]/30"
                  />
                  <span>
                    Li e aceito a{' '}
                    <Link
                      href="/privacidade"
                      target="_blank"
                      className="text-[#228B22] font-medium hover:underline"
                    >
                      Política de Privacidade
                    </Link>{' '}
                    e os{' '}
                    <Link
                      href="/termos"
                      target="_blank"
                      className="text-[#228B22] font-medium hover:underline"
                    >
                      Termos de Uso
                    </Link>{' '}
                    para esta alteração de assinatura.
                  </span>
                </label>
              )}

              {error && (
                <p className="text-sm text-red-600 mb-3">{error}</p>
              )}
              {success && (
                <div className="flex items-center gap-2 text-sm text-green-700 mb-3">
                  <CheckCircle className="w-4 h-4" />
                  {success}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={
                    saving ||
                    previewLoading ||
                    !state ||
                    selectedPlan === state.current_plan ||
                    !termsAccepted ||
                    (impact?.requiresDataLossAck && !dataLossAck)
                  }
                  className="flex items-center gap-2 bg-[#228B22] text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#1a6e1a] transition disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  {saving ? 'Alterando...' : 'Confirmar alteração de plano'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
