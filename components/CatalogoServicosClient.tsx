'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Plus, Pencil, Trash2, X, Upload, ImageIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import {
  CATALOGO_FOTO_MAX_COUNT,
  validateCatalogoFotoClient,
} from '@/lib/catalogoFotos';
import CatalogoFotoLightbox, {
  CatalogoFotoThumbButton,
  type CatalogoFotoLightboxState,
} from '@/components/CatalogoFotoLightbox';

type CatalogoItemTipo = 'servico' | 'produto';
type FiltroTipo = 'todos' | CatalogoItemTipo;

type CatalogoItem = {
  id: string;
  nome: string;
  tipo: CatalogoItemTipo;
  duracao_minutos: number | null;
  preco_centavos: number;
  descricao: string | null;
  estoque: number | null;
  ativo: boolean;
  foto_urls: string[];
};

type FormState = {
  tipo: CatalogoItemTipo;
  nome: string;
  descricao: string;
  duracao_minutos: string;
  preco: string;
  controlar_estoque: boolean;
  estoque: string;
  ativo: boolean;
};

const emptyForm = (tipo: CatalogoItemTipo = 'servico'): FormState => ({
  tipo,
  nome: '',
  descricao: '',
  duracao_minutos: '30',
  preco: '',
  controlar_estoque: false,
  estoque: '0',
  ativo: true,
});

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

function FotosEditor({
  item,
  onChange,
  onPreview,
}: {
  item: CatalogoItem;
  onChange: (foto_urls: string[]) => void;
  onPreview: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const itemLabel = item.tipo === 'produto' ? 'produto' : 'serviço';

  async function handleUpload(file: File) {
    const clientErr = validateCatalogoFotoClient(file);
    if (clientErr) {
      setFotoError(clientErr);
      return;
    }
    if (item.foto_urls.length >= CATALOGO_FOTO_MAX_COUNT) {
      setFotoError(`Máximo de ${CATALOGO_FOTO_MAX_COUNT} fotos por ${itemLabel}.`);
      return;
    }

    setUploading(true);
    setFotoError(null);
    try {
      const fd = new FormData();
      fd.append('servico_id', item.id);
      fd.append('file', file);
      const res = await fetch('/api/catalogo/servicos/foto', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar foto');
      onChange(data.foto_urls ?? data.servico?.foto_urls ?? []);
    } catch (e) {
      setFotoError(e instanceof Error ? e.message : 'Erro ao enviar');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete(url: string) {
    if (!confirm('Remover esta foto?')) return;
    setFotoError(null);
    try {
      const q = new URLSearchParams({ servico_id: item.id, url });
      const res = await fetch(`/api/catalogo/servicos/foto?${q}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao remover');
      onChange(data.foto_urls ?? data.servico?.foto_urls ?? []);
    } catch (e) {
      setFotoError(e instanceof Error ? e.message : 'Erro ao remover');
    }
  }

  return (
    <div className="border-t border-gray-100 pt-4">
      <p className="mb-2 text-sm font-medium text-gray-700">Fotos do {itemLabel}</p>
      <p className="mb-3 text-xs text-gray-500">
        Até {CATALOGO_FOTO_MAX_COUNT} fotos. Até 2 MB no envio; salvamos otimizado em WebP
        (JPEG, PNG ou WebP).
      </p>
      <div className="flex flex-wrap gap-2">
        {item.foto_urls.map((url, i) => (
          <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-xl bg-gray-100">
            <button
              type="button"
              onClick={() => onPreview(i)}
              className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-inset"
              aria-label={`Ampliar foto ${i + 1} de ${item.nome}`}
            >
              <Image src={url} alt="" fill className="object-cover" sizes="80px" />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(url)}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
              title="Remover foto"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {item.foto_urls.length < CATALOGO_FOTO_MAX_COUNT && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 text-xs text-gray-500 hover:border-[var(--brand-primary-hover)] hover:text-[var(--brand-primary)] disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Enviando...' : 'Adicionar'}
            </button>
          </>
        )}
      </div>
      {fotoError && <p className="mt-2 text-xs text-red-600">{fotoError}</p>}
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
  const [itens, setItens] = useState<CatalogoItem[]>([]);
  const [filtro, setFiltro] = useState<FiltroTipo>('todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogoItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [showPostCreateFotosHint, setShowPostCreateFotosHint] = useState(false);
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
    setForm(emptyForm(tipo));
    setShowPostCreateFotosHint(false);
    setModalOpen(true);
  }

  function openEdit(item: CatalogoItem) {
    setShowPostCreateFotosHint(false);
    setEditing(item);
    setForm({
      tipo: item.tipo,
      nome: item.nome,
      descricao: item.descricao ?? '',
      duracao_minutos: String(item.duracao_minutos ?? 30),
      preco: (item.preco_centavos / 100).toFixed(2).replace('.', ','),
      controlar_estoque: item.estoque != null,
      estoque: String(item.estoque ?? 0),
      ativo: item.ativo,
    });
    setModalOpen(true);
  }

  function patchEditingFotos(foto_urls: string[]) {
    if (!editing) return;
    const next = { ...editing, foto_urls };
    setEditing(next);
    setItens((list) => list.map((s) => (s.id === editing.id ? next : s)));
  }

  function normalizeItem(raw: CatalogoItem): CatalogoItem {
    return {
      ...raw,
      tipo: raw.tipo === 'produto' ? 'produto' : 'servico',
      foto_urls: Array.isArray(raw.foto_urls) ? raw.foto_urls : [],
    };
  }

  function resolveSavedItem(
    data: { servico?: CatalogoItem; id?: string },
    fallback: Partial<CatalogoItem>,
  ): CatalogoItem {
    const raw = (data.servico ??
      (data.id ? { ...fallback, id: data.id } : null)) as CatalogoItem | null;
    if (!raw?.id) throw new Error('Resposta inválida ao salvar');
    return normalizeItem(raw);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const precoNum = parseFloat(form.preco.replace(',', '.')) || 0;
    const payload: Record<string, unknown> = {
      tipo: form.tipo,
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      preco_centavos: Math.round(precoNum * 100),
      ativo: form.ativo,
    };

    if (form.tipo === 'servico') {
      payload.duracao_minutos = Math.max(1, parseInt(form.duracao_minutos, 10) || 30);
    } else {
      payload.controlar_estoque = form.controlar_estoque;
      if (form.controlar_estoque) {
        payload.estoque = Math.max(0, parseInt(form.estoque, 10) || 0);
      }
    }

    const isCreate = !editing;
    try {
      const res = await fetch('/api/catalogo/servicos', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');

      const saved = resolveSavedItem(data, payload as Partial<CatalogoItem>);

      if (isCreate) {
        setItens((list) =>
          [...list, saved].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
        );
        setEditing(saved);
        setShowPostCreateFotosHint(true);
        setModalOpen(true);
      } else {
        setItens((list) => list.map((s) => (s.id === saved.id ? saved : s)));
        setModalOpen(false);
        setEditing(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Remover "${nome}" do catálogo?`)) return;
    try {
      const res = await fetch(`/api/catalogo/servicos?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao remover');
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro');
    }
  }

  const editingLive =
    editing && itens.find((s) => s.id === editing.id)
      ? itens.find((s) => s.id === editing.id)!
      : editing;

  const wrapperClass = embedded ? '' : 'mx-auto max-w-4xl px-4 py-8';
  const formTipoLabel = form.tipo === 'produto' ? 'produto' : 'serviço';

  return (
    <div className={wrapperClass}>
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

      <div className="mb-4 flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
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
                      onClick={() => handleDelete(s.id, s.nome)}
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

      <CatalogoFotoLightbox
        open={fotoLightbox !== null}
        onClose={() => setFotoLightbox(null)}
        urls={fotoLightbox?.urls ?? []}
        index={fotoLightbox?.index ?? 0}
        label={fotoLightbox?.label}
      />

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? `Editar ${formTipoLabel}` : `Novo ${formTipoLabel}`}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setShowPostCreateFotosHint(false);
                }}
                className="p-1 text-gray-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              {!editing && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Tipo *</label>
                  <div className="flex gap-2">
                    {(['servico', 'produto'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...emptyForm(t),
                            nome: f.nome,
                            preco: f.preco,
                            ativo: f.ativo,
                          }))
                        }
                        className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                          form.tipo === t
                            ? 'border-[#047482] bg-[#047482]/5 text-[#047482]'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {t === 'servico' ? 'Serviço' : 'Produto'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nome *</label>
                <input
                  required
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  placeholder={form.tipo === 'produto' ? 'Ex.: Shampoo profissional' : 'Ex.: Corte feminino'}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Descrição (opcional)
                </label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  placeholder="Detalhes para o catálogo público"
                />
              </div>

              {form.tipo === 'servico' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Duração (min) *
                    </label>
                    <input
                      required
                      type="number"
                      min={5}
                      step={5}
                      value={form.duracao_minutos}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, duracao_minutos: e.target.value }))
                      }
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Preço (R$) *
                    </label>
                    <input
                      required
                      value={form.preco}
                      onChange={(e) => setForm((f) => ({ ...f, preco: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                      placeholder="79,90"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Preço (R$) *
                    </label>
                    <input
                      required
                      value={form.preco}
                      onChange={(e) => setForm((f) => ({ ...f, preco: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                      placeholder="49,90"
                    />
                  </div>
                  <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={form.controlar_estoque}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, controlar_estoque: e.target.checked }))
                        }
                        className="rounded border-gray-300"
                      />
                      Controlar estoque disponível
                    </label>
                    {form.controlar_estoque && (
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Quantidade em estoque
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={form.estoque}
                          onChange={(e) => setForm((f) => ({ ...f, estoque: e.target.value }))}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                Ativo (visível no catálogo público)
              </label>

              {editingLive?.id ? (
                <>
                  {showPostCreateFotosHint && (
                    <p className="border-t border-gray-100 pt-3 text-xs text-green-700">
                      Item salvo. Adicione fotos abaixo ou feche o formulário quando terminar.
                    </p>
                  )}
                  <FotosEditor
                    key={editingLive.id}
                    item={editingLive}
                    onChange={patchEditingFotos}
                    onPreview={(index) =>
                      openFotoLightbox(editingLive.foto_urls, index, editingLive.nome)
                    }
                  />
                </>
              ) : (
                <p className="border-t border-gray-100 pt-3 text-xs text-gray-500">
                  Ao salvar, você poderá enviar até {CATALOGO_FOTO_MAX_COUNT} fotos (2 MB cada)
                  neste mesmo formulário.
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setShowPostCreateFotosHint(false);
                  }}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600"
                >
                  {showPostCreateFotosHint ? 'Fechar' : 'Cancelar'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-[#047482] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
