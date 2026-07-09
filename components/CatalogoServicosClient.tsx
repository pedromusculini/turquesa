'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ImageIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import CatalogoFotoLightbox, {
  CatalogoFotoThumbButton,
  type CatalogoFotoLightboxState,
} from '@/components/CatalogoFotoLightbox';
import { invalidateCatalogoServicosClientCache } from '@/lib/catalogoServicosClient';
import CatalogoServicoFormModal, {
  type CatalogoItem,
  type CatalogoItemTipo,
} from '@/components/CatalogoServicoFormModal';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';

type FiltroTipo = 'todos' | CatalogoItemTipo;

function FotoThumbs({
  urls,
  itemNome,
  onOpen,
}: {
  urls: string[];
  itemNome: string;
  onOpen: (index: number) => void;
}) {
  if (!urls.length) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <ImageIcon className="h-3.5 w-3.5" /> Sem foto
      </span>
    );
  }
  return (
    <div className="flex gap-1">
      {urls.map((url, i) => (
        <CatalogoFotoThumbButton
          key={url}
          url={url}
          index={i}
          alt={itemNome}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

function TipoBadge({ tipo }: { tipo: CatalogoItemTipo }) {
  if (tipo === 'produto') {
    return (
      <span className="rounded-full bg-[#c69c6c]/15 px-2 py-0.5 text-xs font-medium text-[#8a6b45]">
        Produto
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[#047482]/10 px-2 py-0.5 text-xs font-medium text-[#047482]">
      Serviço
    </span>
  );
}

function formatDetalhe(item: CatalogoItem) {
  if (item.tipo === 'produto') {
    if (item.estoque != null) return `${item.estoque} em estoque`;
    return 'Sem controle de estoque';
  }
  return `${item.duracao_minutos ?? 30} min`;
}

export default function CatalogoServicosClient({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [itens, setItens] = useState<CatalogoItem[]>([]);
  const [filtro, setFiltro] = useState<FiltroTipo>('todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogoItem | null>(null);
  const [initialTipo, setInitialTipo] = useState<CatalogoItemTipo>('servico');
  const [fotoLightbox, setFotoLightbox] = useState<CatalogoFotoLightboxState>(null);

  const itensFiltrados = useMemo(() => {
    if (filtro === 'todos') return itens;
    return itens.filter((i) => i.tipo === filtro);
  }, [itens, filtro]);

  function openFotoLightbox(urls: string[], index: number, label: string) {
    if (!urls.length) return;
    setFotoLightbox({ urls, index, label });
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/catalogo/servicos');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar');
      setItens(
        (data.servicos ?? []).map((s: CatalogoItem) => ({
          ...s,
          tipo: s.tipo === 'produto' ? 'produto' : 'servico',
          duracao_minutos: s.duracao_minutos ?? null,
          descricao: s.descricao ?? null,
          estoque: s.estoque ?? null,
          foto_urls: Array.isArray(s.foto_urls) ? s.foto_urls : [],
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openNew(tipo: CatalogoItemTipo = 'servico') {
    setEditing(null);
    setInitialTipo(tipo);
    setModalOpen(true);
  }

  function openEdit(item: CatalogoItem) {
    setEditing(item);
    setInitialTipo(item.tipo);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleItemUpserted(item: CatalogoItem, isCreate: boolean) {
    if (isCreate) {
      setItens((list) =>
        [...list, item].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      );
      toast.success('Item cadastrado no catálogo.');
    } else {
      setItens((list) => list.map((s) => (s.id === item.id ? item : s)));
      toast.success('Item atualizado.');
    }
    closeModal();
  }

  function handleFotosChange(id: string, foto_urls: string[]) {
    setItens((list) => list.map((s) => (s.id === id ? { ...s, foto_urls } : s)));
  }

  async function handleDelete(id: string, nome: string) {
    const ok = await confirm({
      title: 'Remover do catálogo',
      message: `Remover "${nome}" do catálogo? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Remover',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/catalogo/servicos?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao remover');
      }
      invalidateCatalogoServicosClientCache();
      toast.success('Item removido do catálogo.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  }

  const wrapperClass = embedded ? '' : 'mx-auto max-w-4xl px-4 py-8';

  return (
    <div className={wrapperClass}>
      <div className={modalOpen ? 'pointer-events-none select-none' : undefined}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {!embedded && (
            <h1 className="text-2xl font-bold text-gray-900">Catálogo</h1>
          )}
          <p className={`text-sm text-gray-500 ${embedded ? '' : 'mt-1'}`}>
            Cadastre serviços (com duração) e produtos (estoque opcional) do salão.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openNew('produto')}
            className="inline-flex items-center gap-2 rounded-xl border border-[#047482] px-4 py-2.5 text-sm font-semibold text-[#047482] hover:bg-[#047482]/5"
          >
            <Plus className="h-4 w-4" />
            Novo produto
          </button>
          <button
            type="button"
            data-tour="catalogo-novo-servico"
            onClick={() => openNew('servico')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#047482] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#035e6b]"
          >
            <Plus className="h-4 w-4" />
            Novo serviço
          </button>
        </div>
      </div>

      <div
        className="mb-4 flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1"
        data-tour="catalogo-tab-servicos"
      >
        {(
          [
            { id: 'todos' as const, label: 'Todos' },
            { id: 'servico' as const, label: 'Serviços' },
            { id: 'produto' as const, label: 'Produtos' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFiltro(t.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              filtro === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-gray-500">Carregando...</p>
        ) : itensFiltrados.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">
            {filtro === 'todos'
              ? 'Nenhum item cadastrado. Adicione um serviço ou produto para começar.'
              : filtro === 'servico'
                ? 'Nenhum serviço cadastrado.'
                : 'Nenhum produto cadastrado.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Fotos</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Detalhe</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {itensFiltrados.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <FotoThumbs
                      urls={s.foto_urls}
                      itemNome={s.nome}
                      onOpen={(index) => openFotoLightbox(s.foto_urls, index, s.nome)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{s.nome}</div>
                    {s.descricao && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{s.descricao}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <TipoBadge tipo={s.tipo} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDetalhe(s)}</td>
                  <td className="px-4 py-3 text-gray-900">
                    {formatCurrency(s.preco_centavos / 100)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.ativo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {s.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="p-1.5 text-gray-400 hover:text-[var(--brand-primary)]"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(s.id, s.nome)}
                      className="p-1.5 text-gray-400 hover:text-red-600"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      </div>

      <CatalogoFotoLightbox
        open={fotoLightbox !== null}
        onClose={() => setFotoLightbox(null)}
        urls={fotoLightbox?.urls ?? []}
        index={fotoLightbox?.index ?? 0}
        label={fotoLightbox?.label}
      />

      <CatalogoServicoFormModal
        open={modalOpen}
        editing={editing}
        initialTipo={initialTipo}
        onClose={closeModal}
        onItemUpserted={handleItemUpserted}
        onFotosChange={handleFotosChange}
        onPreviewFotos={openFotoLightbox}
      />
    </div>
  );
}
