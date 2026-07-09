'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  MAX_CATEGORIAS_SAIDA,
  type CategoriaSaida,
} from '@/lib/configCategoriasSaida';
import { invalidateCategoriasSaidaCache } from '@/lib/categoriasSaidaClient';
import { useCustomSession } from '@/lib/useSession';

export default function ConfigCategoriasSaidaSection() {
  const { data: session } = useCustomSession();
  const ownerEmail = session?.user?.email?.toLowerCase().trim() ?? '';

  const [categorias, setCategorias] = useState<CategoriaSaida[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/config/categorias-saida');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar');
      setCategorias(Array.isArray(data.categorias) ? data.categorias : []);
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

  function addCategoria() {
    if (categorias.length >= MAX_CATEGORIAS_SAIDA) return;
    setCategorias((prev) => [
      ...prev,
      { id: `nova_${Date.now()}`, label: '' },
    ]);
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
      setMessage(data.message ?? 'Categorias salvas.');
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
        Personalize as opções ao lançar saídas no Financeiro (aluguel, material, comissões
        fixas, etc.). Transações antigas mantêm a categoria original.
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
        {categorias.map((cat, index) => (
          <div key={`${cat.id}-${index}`} className="flex items-center gap-2">
            <input
              type="text"
              value={cat.label}
              onChange={(e) => updateLabel(index, e.target.value)}
              placeholder="Nome da categoria"
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 focus:border-[#047482] focus:outline-none focus:ring-2 focus:ring-[#047482]/15"
            />
            <button
              type="button"
              onClick={() => removeAt(index)}
              disabled={categorias.length <= 1}
              className="rounded-xl border border-gray-200 p-2.5 text-gray-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              title="Remover categoria"
              aria-label="Remover categoria"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
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
