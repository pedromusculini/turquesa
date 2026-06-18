'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Package, Scissors } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import { formatCurrency } from '@/lib/constants';
import {
  type AtendimentoItemLinha,
  type CatalogoItemResumo,
  calcularTotalItens,
  linhaFromCatalogo,
  newItemKey,
  prefillItensFromConsulta,
} from '@/lib/atendimentoItens';
import { fetchCatalogoServicos, readCatalogoServicosClientCache } from '@/lib/catalogoServicosClient';

type Props = {
  itens: AtendimentoItemLinha[];
  onChange: (itens: AtendimentoItemLinha[]) => void;
  onTotalChange?: (total: number) => void;
  disabled?: boolean;
};

function tipoIcon(tipo: 'servico' | 'produto') {
  return tipo === 'produto' ? Package : Scissors;
}

export default function AtendimentoItensEditor({
  itens,
  onChange,
  onTotalChange,
  disabled = false,
}: Props) {
  const [catalogo, setCatalogo] = useState<CatalogoItemResumo[]>(
    () => readCatalogoServicosClientCache() ?? [],
  );
  const [loading, setLoading] = useState(() => !readCatalogoServicosClientCache());
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollToKeyRef = useRef<string | null>(null);

  const loadCatalogo = useCallback(async () => {
    setLoadError(null);
    const stale = readCatalogoServicosClientCache();
    if (stale) {
      setCatalogo(stale);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const items = await fetchCatalogoServicos();
      setCatalogo(items);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Erro ao carregar catálogo');
      if (!stale) setCatalogo([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalogo();
  }, [loadCatalogo]);

  const total = useMemo(() => calcularTotalItens(itens), [itens]);

  const estoqueWarnings = useMemo(() => {
    const warnings: string[] = [];
    for (const linha of itens) {
      if (linha.tipo !== 'produto' || !linha.catalogoId) continue;
      const cat = catalogo.find((c) => c.id === linha.catalogoId);
      if (!cat || cat.estoque == null) continue;
      if (linha.quantidade > cat.estoque) {
        warnings.push(
          `"${linha.nome}": disponível ${cat.estoque}, solicitado ${linha.quantidade}`,
        );
      }
    }
    return warnings;
  }, [itens, catalogo]);

  useEffect(() => {
    onTotalChange?.(total);
  }, [total, onTotalChange]);

  const options = useMemo(
    () =>
      catalogo.map((c) => ({
        value: c.id,
        label: c.nome,
        sublabel:
          c.tipo === 'produto'
            ? `Produto · ${formatCurrency(c.preco_centavos / 100)}`
            : `Serviço · ${formatCurrency(c.preco_centavos / 100)}`,
      })),
    [catalogo],
  );

  const usedIds = useMemo(() => new Set(itens.map((i) => i.catalogoId)), [itens]);

  function addLinha() {
    const key = newItemKey();
    scrollToKeyRef.current = key;
    onChange([
      ...itens,
      {
        key,
        catalogoId: '',
        nome: '',
        tipo: 'servico',
        precoCentavos: 0,
        quantidade: 1,
      },
    ]);
  }

  useEffect(() => {
    const key = scrollToKeyRef.current;
    if (!key) return;
    scrollToKeyRef.current = null;
    requestAnimationFrame(() => {
      document
        .getElementById(`catalogo-linha-${key}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    });
  }, [itens.length]);

  function updateLinha(key: string, patch: Partial<AtendimentoItemLinha>) {
    onChange(itens.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function selectCatalogo(key: string, catalogoId: string) {
    const item = catalogo.find((c) => c.id === catalogoId);
    if (!item) return;
    updateLinha(key, { ...linhaFromCatalogo(item), key });
  }

  function removeLinha(key: string) {
    onChange(itens.filter((i) => i.key !== key));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-sm font-medium text-gray-700">
          Serviços e produtos
        </label>
        {itens.length > 0 && (
          <span className="text-xs font-medium text-[#047482]">
            Subtotal: {formatCurrency(total)}
          </span>
        )}
      </div>

      {loading && (
        <p className="text-xs text-gray-500">Carregando catálogo...</p>
      )}
      {loadError && (
        <p className="text-xs text-amber-700 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          {loadError}. Cadastre itens em Catálogo.
        </p>
      )}
      {estoqueWarnings.length > 0 && (
        <p className="text-xs text-amber-800 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          Estoque insuficiente: {estoqueWarnings.join(' · ')}
        </p>
      )}
      {!loading && !loadError && catalogo.length === 0 && (
        <p className="text-xs text-gray-500">
          Nenhum serviço ou produto no catálogo. Cadastre em{' '}
          <span className="text-[#047482] font-medium">Catálogo</span>.
        </p>
      )}

      {itens.length > 0 && (
        <ul className="space-y-2">
          {itens.map((linha) => {
            const Icon = tipoIcon(linha.tipo);
            const rowOptions = options.filter(
              (o) => o.value === linha.catalogoId || !usedIds.has(o.value),
            );
            return (
              <li
                key={linha.key}
                id={`catalogo-linha-${linha.key}`}
                className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <SearchableSelect
                      options={rowOptions}
                      value={linha.catalogoId}
                      onChange={(id) => selectCatalogo(linha.key, id)}
                      placeholder="Buscar serviço ou produto..."
                      searchPlaceholder="Digite para buscar..."
                      dropdownMode="fixed"
                      disabled={disabled || loading}
                      listMaxHeight="max-h-40"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLinha(linha.key)}
                    disabled={disabled}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0 touch-manipulation"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {linha.catalogoId && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Icon className="w-3.5 h-3.5" />
                      {linha.tipo === 'produto' ? 'Produto' : 'Serviço'} ·{' '}
                      {formatCurrency(linha.precoCentavos / 100)} un.
                      {(() => {
                        const cat = catalogo.find((c) => c.id === linha.catalogoId);
                        if (cat?.tipo === 'produto' && cat.estoque != null) {
                          return ` · ${cat.estoque} em estoque`;
                        }
                        return null;
                      })()}
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">Qtd</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={linha.quantidade}
                        onChange={(e) =>
                          updateLinha(linha.key, {
                            quantidade: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        disabled={disabled}
                        className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm text-center"
                      />
                      <span className="text-xs font-medium text-gray-700 min-w-[4.5rem] text-right">
                        {formatCurrency((linha.precoCentavos * linha.quantidade) / 100)}
                      </span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          addLinha();
        }}
        disabled={disabled || loading || catalogo.length === 0}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-[#047482] hover:border-[#047482] hover:bg-[var(--brand-bg-onboarding)] disabled:opacity-50 touch-manipulation"
      >
        <Plus className="w-4 h-4" />
        Adicionar serviço ou produto
      </button>
    </div>
  );
}

/** Carrega catálogo e retorna itens pré-preenchidos a partir da sessão. */
export async function fetchPrefillItensFromService(
  service?: string,
  catalogoItens?: AtendimentoItemLinha[],
): Promise<AtendimentoItemLinha[]> {
  if (catalogoItens?.length) {
    return catalogoItens.map((i) => ({ ...i, key: i.key || newItemKey() }));
  }
  try {
    const catalog = await fetchCatalogoServicos();
    return prefillItensFromConsulta(catalog, { service, catalogoItens });
  } catch {
    return [];
  }
}
