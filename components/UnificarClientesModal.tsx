'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Merge, X } from 'lucide-react';
import type { Cliente } from '@/lib/types';
import { aplicarMascaraWhatsapp } from '@/lib/constants';

type DuplicatePair = {
  primaryId: string;
  primaryNome: string;
  primaryTelefone: string | null;
  primaryAtendimentos: number;
  secondaryId: string;
  secondaryNome: string;
  secondaryTelefone: string | null;
  secondaryAtendimentos: number;
  motivo: string;
};

type MergePreview = {
  primary: { id: string; nome: string; telefone: string | null; atendimentos: number };
  secondary: { id: string; nome: string; telefone: string | null; atendimentos: number };
  willGainTelefone: boolean;
  willMergeAtendimentos: number;
  willMergeObservacoes: number;
  willMergePagamentos: number;
  willMergeAnamnese: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  clientes: Cliente[];
  selectedPrimaryId?: string | null;
  onMerged: (primaryId: string) => void | Promise<void>;
};

export default function UnificarClientesModal({
  open,
  onClose,
  clientes,
  selectedPrimaryId,
  onMerged,
}: Props) {
  const [sugestoes, setSugestoes] = useState<DuplicatePair[]>([]);
  const [manualClientes, setManualClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [primaryId, setPrimaryId] = useState('');
  const [secondaryId, setSecondaryId] = useState('');
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  const loadManualClientes = useCallback(async () => {
    try {
      const res = await fetch('/api/clientes?all=1');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar clientes');
      setManualClientes((data.clientes ?? []) as Cliente[]);
    } catch {
      setManualClientes(clientes);
    }
  }, [clientes]);

  const loadSugestoes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clientes/unificar');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar sugestões');
      setSugestoes(data.sugestoes ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPreview = useCallback(async (pId: string, sId: string) => {
    if (!pId || !sId || pId === sId) {
      setPreview(null);
      setError(null);
      return;
    }
    try {
      const params = new URLSearchParams({ primaryId: pId, secondaryId: sId });
      const res = await fetch(`/api/clientes/unificar?${params}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao carregar prévia da unificação');
      }
      if (data.previewError) {
        setPreview(null);
        setError(String(data.previewError));
        return;
      }
      setError(null);
      setPreview(data.preview ?? null);
      if (!data.preview) {
        setError('Não foi possível gerar a prévia. Atualize a página e tente novamente.');
      }
    } catch (e: unknown) {
      setPreview(null);
      setError(e instanceof Error ? e.message : 'Erro ao carregar prévia');
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setPrimaryId(selectedPrimaryId ?? '');
    setSecondaryId('');
    setPreview(null);
    setConfirmStep(false);
    setError(null);
    void loadSugestoes();
    void loadManualClientes();
  }, [open, selectedPrimaryId, loadSugestoes, loadManualClientes]);

  useEffect(() => {
    if (!open || !primaryId || !secondaryId) return;
    void loadPreview(primaryId, secondaryId);
  }, [open, primaryId, secondaryId, loadPreview]);

  function applySugestao(pair: DuplicatePair) {
    setPrimaryId(pair.primaryId);
    setSecondaryId(pair.secondaryId);
    setConfirmStep(true);
  }

  async function executarMerge() {
    if (!primaryId || !secondaryId) return;
    setMerging(true);
    setError(null);
    try {
      const res = await fetch('/api/clientes/unificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryId, secondaryId }),
      });
      let data: { error?: string; success?: boolean } = {};
      try {
        data = await res.json();
      } catch {
        throw new Error('Resposta inválida do servidor. Tente novamente.');
      }
      if (!res.ok) {
        throw new Error(
          data.error ||
            (res.status === 404
              ? 'Cliente não encontrado. Atualize a página e tente novamente.'
              : 'Erro ao unificar clientes'),
        );
      }
      await onMerged(primaryId);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao unificar');
    } finally {
      setMerging(false);
    }
  }

  if (!open) return null;

  const sortedClientes = [...manualClientes].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR'),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Merge className="w-5 h-5 text-[#047482]" />
              Unificar clientes
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Mantém o cadastro principal e mescla telefone, histórico e anamnese do duplicado.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {error && (
            <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <section>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">
              Sugestões automáticas ({sugestoes.length})
            </h4>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Analisando duplicatas...
              </div>
            ) : sugestoes.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nenhuma duplicata detectada (mesmo telefone, e-mail ou nome parecido).
              </p>
            ) : (
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {sugestoes.map((s) => (
                  <li
                    key={`${s.primaryId}:${s.secondaryId}`}
                    className="border border-gray-100 rounded-xl p-3 text-sm"
                  >
                    <p className="font-medium text-gray-900">
                      Manter: {s.primaryNome}
                      <span className="font-normal text-gray-500">
                        {' '}
                        ({s.primaryAtendimentos} atend.)
                      </span>
                    </p>
                    <p className="text-gray-600 mt-0.5">
                      Mesclar: {s.secondaryNome}
                      {s.secondaryTelefone && (
                        <span className="text-[#047482]">
                          {' '}
                          · {aplicarMascaraWhatsapp(s.secondaryTelefone)}
                        </span>
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => applySugestao(s)}
                      className="mt-2 text-xs font-medium text-[#047482] hover:underline"
                    >
                      Revisar e unificar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border-t border-gray-100 pt-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Unificação manual</h4>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs text-gray-600">
                Manter (cadastro principal)
                <select
                  value={primaryId}
                  onChange={(e) => {
                    setPrimaryId(e.target.value);
                    setConfirmStep(false);
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Selecione...</option>
                  {sortedClientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                      {c.telefone ? ` · ${c.telefone}` : ' · sem tel.'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-gray-600">
                Mesclar e excluir (duplicata)
                <select
                  value={secondaryId}
                  onChange={(e) => {
                    setSecondaryId(e.target.value);
                    setConfirmStep(false);
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Selecione...</option>
                  {sortedClientes
                    .filter((c) => c.id !== primaryId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                        {c.telefone ? ` · ${c.telefone}` : ' · sem tel.'}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </section>

          {preview && (
            <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm space-y-2">
              <p className="font-medium text-amber-900">O que será feito</p>
              <ul className="text-amber-900 space-y-1 list-disc list-inside">
                <li>
                  Manter <strong>{preview.primary.nome}</strong> ({preview.primary.atendimentos}{' '}
                  atendimentos)
                </li>
                <li>
                  Excluir cadastro <strong>{preview.secondary.nome}</strong> (
                  {preview.secondary.atendimentos} atendimentos serão transferidos)
                </li>
                {preview.willGainTelefone && (
                  <li>
                    Copiar telefone{' '}
                    {preview.secondary.telefone
                      ? aplicarMascaraWhatsapp(preview.secondary.telefone)
                      : ''}{' '}
                    para o cadastro principal
                  </li>
                )}
                {preview.willMergeObservacoes > 0 && (
                  <li>{preview.willMergeObservacoes} observação(ões) serão mescladas</li>
                )}
                {preview.willMergePagamentos > 0 && (
                  <li>{preview.willMergePagamentos} pagamento(s) serão mesclados</li>
                )}
                {preview.willMergeAnamnese && <li>Anamnese será mesclada</li>}
                <li>Agendamentos e índice de pacientes serão atualizados</li>
              </ul>
            </section>
          )}
        </div>

        <div className="p-5 border-t flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm"
          >
            Cancelar
          </button>
          {!confirmStep ? (
            <button
              type="button"
              disabled={!preview || !primaryId || !secondaryId}
              onClick={() => setConfirmStep(true)}
              className="flex-1 py-2.5 rounded-lg bg-[#047482] text-white text-sm font-medium disabled:opacity-50"
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              disabled={merging || !preview}
              onClick={() => void executarMerge()}
              className="flex-1 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {merging ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Unificando...
                </>
              ) : (
                'Confirmar unificação'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
