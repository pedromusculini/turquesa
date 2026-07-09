'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  MAX_CATEGORIAS_SAIDA,
  type CategoriaSaida,
} from '@/lib/configCategoriasSaida';
import { sortCategoriasByUsage, moveCategoria } from '@/lib/categoriasSaidaOrder';
import { invalidateCategoriasSaidaCache } from '@/lib/categoriasSaidaClient';
import { useCustomSession } from '@/lib/useSession';

export default function ConfigCategoriasSaidaSection() {
  const { data: session } = useCustomSession();
  const ownerEmail = session?.user?.email?.toLowerCase().trim() ?? '';

  const [categorias, setCategorias] = useState<CategoriaSaida[]>([]);
  const [usageById, setUsageById] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/config/categorias-saida?sort=stored');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar');
      setCategorias(Array.isArray(data.categorias) ? data.categorias : []);
      setUsageById(
        data.usageById && typeof data.usageById === 'object' ? data.usageById : {},
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

  function updateLabel(index: number, label: string) {
    setCategorias((prev) =>
      prev.map((c, i) => (i === index ? { ...c, label } : c)),
    );
  }

  function removeAt(index: number) {
    setCategorias((prev) => prev.filter((_, i) => i !== index));
  }

  function moveRow(index: number, direction: -1 | 1) {
    setCategorias((prev) => moveCategoria(prev, index, index + direction));
  }

  function ordenarPorUso() {
    setCategorias((prev) => sortCategoriasByUsage(prev, usageById));
    setMessage('Ordem atualizada pela frequência de uso (salve para persistir).');
    setError(null);
  }

  function addCategoria() {
    if (categorias.length >= MAX_CATEGORIAS_SAIDA) return;
    const id = `nova_${Date.now()}`;
    setCategorias((prev) => [...prev, { id, label: '' }]);
    setEditingId(id);
    setTimeout(() => inputRefs.current[id]?.focus(), 0);
  }

  function startEdit(id: string) {
    setEditingId(id);
    setTimeout(() => inputRefs.current[id]?.focus(), 0);
  }

  async function salvar() {
    const limpas = categorias
      .map((c) => ({ ...c, label: c.label.trim() }))
      .filter((c) => c.label.length > 0);

    if (limpas.length === 0) {
      setError('Adicione pelo menos uma categoria.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/config/categorias-saida', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categorias: limpas }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      setCategorias(data.categorias ?? limpas);
      invalidateCategoriasSaidaCache(ownerEmail);
      setEditingId(null);
      setMessage(data.message ?? 'Categorias salvas.');
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando categorias de despesa...
      </div>
    );
  }

  return (
    <section
      className="mt-8 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
      data-tour="config-categorias-saida"
    >
      <h2 className="text-lg font-bold text-gray-900">Categorias de despesa</h2>
      <p className="mt-1 text-sm text-gray-500">
        Personalize as opções ao lançar saídas no Financeiro. No lançamento, a lista
        aparece automaticamente da <strong>mais usada</strong> para a menos usada.
        Aqui você edita nomes e define a ordem padrão salva.
      </p>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
      {message && (
        <p className="mt-4 rounded-xl bg-[#eef4f5] px-4 py-3 text-sm text-[#047482]">
          {message}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {categorias.map((cat, index) => {
          const uso = usageById[cat.id] ?? 0;
          const isEditing = editingId === cat.id || !cat.label.trim();

          return (
            <div
              key={`${cat.id}-${index}`}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/50 p-2 sm:flex-nowrap"
            >
              <div className="flex shrink-0 flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveRow(index, -1)}
                  disabled={index === 0}
                  className="rounded-lg border border-gray-200 p-1 text-gray-500 hover:bg-white disabled:opacity-30"
                  title="Subir"
                  aria-label="Subir categoria"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveRow(index, 1)}
                  disabled={index >= categorias.length - 1}
                  className="rounded-lg border border-gray-200 p-1 text-gray-500 hover:bg-white disabled:opacity-30"
                  title="Descer"
                  aria-label="Descer categoria"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {isEditing ? (
                <input
                  ref={(el) => {
                    inputRefs.current[cat.id] = el;
                  }}
                  type="text"
                  value={cat.label}
                  onChange={(e) => updateLabel(index, e.target.value)}
                  onBlur={() => {
                    if (cat.label.trim()) setEditingId(null);
                  }}
                  placeholder="Nome da categoria"
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 focus:border-[#047482] focus:outline-none focus:ring-2 focus:ring-[#047482]/15"
                />
              ) : (
                <div className="min-w-0 flex-1 rounded-xl border border-transparent bg-white px-4 py-2.5 text-sm font-medium text-gray-800">
                  {cat.label}
                </div>
              )}

              <span
                className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs text-gray-500 ring-1 ring-gray-200"
                title="Vezes usada em saídas"
              >
                {uso === 0 ? 'Sem uso' : `${uso}×`}
              </span>

              <button
                type="button"
                onClick={() => startEdit(cat.id)}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#047482]/25 px-3 py-2 text-xs font-semibold text-[#047482] transition hover:bg-[#eef4f5]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </button>

              <button
                type="button"
                onClick={() => removeAt(index)}
                disabled={categorias.length <= 1}
                className="shrink-0 rounded-xl border border-gray-200 p-2.5 text-gray-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                title="Remover categoria"
                aria-label="Remover categoria"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={addCategoria}
          disabled={categorias.length >= MAX_CATEGORIAS_SAIDA}
          className="inline-flex items-center gap-2 rounded-xl border border-[#047482]/30 px-4 py-2.5 text-sm font-semibold text-[#047482] transition hover:bg-[#eef4f5] disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Adicionar categoria
        </button>
        <button
          type="button"
          onClick={ordenarPorUso}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          <BarChart3 className="h-4 w-4" />
          Ordenar por mais usadas
        </button>
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[#047482] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#035e6b] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar categorias
        </button>
      </div>
    </section>
  );
}
