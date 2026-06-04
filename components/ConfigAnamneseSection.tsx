'use client';

import { useCallback, useEffect, useState } from 'react';
import { GripVertical, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import {
  ANAMNESE_TIPO_LABELS,
  type AnamneseCampo,
  type AnamneseCampoInput,
  type AnamneseCampoTipo,
} from '@/lib/anamnese';

type Draft = AnamneseCampoInput & { _key: string };

function newDraft(ordem: number): Draft {
  return {
    _key: `new-${Date.now()}-${ordem}`,
    ordem,
    label: '',
    tipo: 'texto_curto',
    opcoes: ['', ''],
    obrigatorio: false,
  };
}

export default function ConfigAnamneseSection() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/config/anamnese');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar');
      const campos = (data.campos ?? []) as AnamneseCampo[];
      setDrafts(
        campos.map((c, i) => ({
          _key: c.id,
          id: c.id,
          ordem: c.ordem ?? i,
          label: c.label,
          tipo: c.tipo,
          opcoes: c.opcoes.length >= 2 ? c.opcoes : ['', ''],
          obrigatorio: c.obrigatorio,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDraft(key: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d._key === key ? { ...d, ...patch } : d)));
  }

  function moveDraft(key: string, dir: -1 | 1) {
    setDrafts((prev) => {
      const idx = prev.findIndex((d) => d._key === key);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy.map((d, i) => ({ ...d, ordem: i }));
    });
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);
    const campos = drafts
      .map((d, i) => {
        const label = d.label.trim();
        if (!label) return null;
        const base = {
          ordem: i,
          label,
          tipo: d.tipo,
          obrigatorio: d.obrigatorio,
        };
        if (d.tipo === 'opcoes') {
          const opcoes = (d.opcoes ?? []).map((o) => o.trim()).filter(Boolean);
          if (opcoes.length < 2) return null;
          return { ...base, opcoes };
        }
        return base;
      })
      .filter(Boolean);

    if (drafts.some((d) => d.label.trim()) && campos.length !== drafts.filter((d) => d.label.trim()).length) {
      setError('Campos do tipo "Opções" precisam de pelo menos 2 opções preenchidas.');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/config/anamnese', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      setMessage('Campos salvos. Eles aparecem no formulário público de cadastro.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin text-[#047482]" />
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 leading-relaxed">
        Defina perguntas extras para o link público de cadastro de clientes (anamnese, preferências,
        alergias, etc.). Campos vazios não são salvos.
      </p>

      {drafts.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          Nenhum campo configurado. Adicione o primeiro abaixo.
        </p>
      )}

      <ul className="space-y-4">
        {drafts.map((d, index) => (
          <li
            key={d._key}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3"
          >
            <div className="flex items-start gap-2">
              <div className="flex flex-col gap-0.5 pt-2 text-gray-400">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveDraft(d._key, -1)}
                  className="text-xs disabled:opacity-30"
                  aria-label="Subir"
                >
                  ▲
                </button>
                <GripVertical className="h-4 w-4" aria-hidden />
                <button
                  type="button"
                  disabled={index === drafts.length - 1}
                  onClick={() => moveDraft(d._key, 1)}
                  className="text-xs disabled:opacity-30"
                  aria-label="Descer"
                >
                  ▼
                </button>
              </div>
              <div className="flex-1 space-y-3">
                <input
                  value={d.label}
                  onChange={(e) => updateDraft(d._key, { label: e.target.value })}
                  placeholder="Ex.: Possui alergia a produtos?"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium"
                />
                <div className="flex flex-wrap gap-3">
                  <select
                    value={d.tipo}
                    onChange={(e) =>
                      updateDraft(d._key, {
                        tipo: e.target.value as AnamneseCampoTipo,
                        opcoes: e.target.value === 'opcoes' ? ['', ''] : undefined,
                      })
                    }
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    {(Object.keys(ANAMNESE_TIPO_LABELS) as AnamneseCampoTipo[]).map((t) => (
                      <option key={t} value={t}>
                        {ANAMNESE_TIPO_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={d.obrigatorio}
                      onChange={(e) => updateDraft(d._key, { obrigatorio: e.target.checked })}
                    />
                    Obrigatório
                  </label>
                </div>
                {d.tipo === 'opcoes' && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Opções (mínimo 2)</p>
                    {(d.opcoes ?? ['', '']).map((op, oi) => (
                      <input
                        key={oi}
                        value={op}
                        onChange={(e) => {
                          const next = [...(d.opcoes ?? ['', ''])];
                          next[oi] = e.target.value;
                          updateDraft(d._key, { opcoes: next });
                        }}
                        placeholder={`Opção ${oi + 1}`}
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                      />
                    ))}
                    {(d.opcoes?.length ?? 0) < 8 && (
                      <button
                        type="button"
                        onClick={() =>
                          updateDraft(d._key, { opcoes: [...(d.opcoes ?? []), ''] })
                        }
                        className="text-xs text-[#047482] font-medium"
                      >
                        + Adicionar opção
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDrafts((prev) => prev.filter((x) => x._key !== d._key))}
                className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                aria-label="Remover campo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDrafts((prev) => [...prev, newDraft(prev.length)])}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" />
          Adicionar campo
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[#047482] px-4 py-2 text-sm font-semibold text-white hover:bg-[#035e6b] disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar anamnese
        </button>
      </div>

      {message && (
        <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
