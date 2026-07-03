'use client';

import { memo, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Trash2, Upload, X } from 'lucide-react';
import {
  CATALOGO_FOTO_MAX_COUNT,
  validateCatalogoFotoClient,
} from '@/lib/catalogoFotos';
import { invalidateCatalogoServicosClientCache } from '@/lib/catalogoServicosClient';

export type CatalogoItemTipo = 'servico' | 'produto';

export type CatalogoItem = {
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

function itemToForm(item: CatalogoItem): FormState {
  return {
    tipo: item.tipo,
    nome: item.nome,
    descricao: item.descricao ?? '',
    duracao_minutos: String(item.duracao_minutos ?? 30),
    preco: (item.preco_centavos / 100).toFixed(2).replace('.', ','),
    controlar_estoque: item.estoque != null,
    estoque: String(item.estoque ?? 0),
    ativo: item.ativo,
  };
}

function normalizeItem(raw: CatalogoItem): CatalogoItem {
  return {
    ...raw,
    tipo: raw.tipo === 'produto' ? 'produto' : 'servico',
    foto_urls: Array.isArray(raw.foto_urls) ? raw.foto_urls : [],
  };
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

type Props = {
  open: boolean;
  editing: CatalogoItem | null;
  initialTipo: CatalogoItemTipo;
  onClose: () => void;
  onItemUpserted: (item: CatalogoItem, isCreate: boolean) => void;
  onFotosChange: (id: string, foto_urls: string[]) => void;
  onPreviewFotos: (urls: string[], index: number, label: string) => void;
};

function CatalogoServicoFormModal({
  open,
  editing,
  initialTipo,
  onClose,
  onItemUpserted,
  onFotosChange,
  onPreviewFotos,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm(initialTipo));
  const [liveItem, setLiveItem] = useState<CatalogoItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPostCreateFotosHint, setShowPostCreateFotosHint] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setShowPostCreateFotosHint(false);
    if (editing) {
      setForm(itemToForm(editing));
      setLiveItem(editing);
    } else {
      setForm(emptyForm(initialTipo));
      setLiveItem(null);
    }
  }, [open, editing, initialTipo]);

  if (!open) return null;

  const formTipoLabel = form.tipo === 'produto' ? 'produto' : 'serviço';

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

    const currentId = liveItem?.id ?? editing?.id;
    const isCreate = !currentId;
    try {
      const res = await fetch('/api/catalogo/servicos', {
        method: currentId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentId ? { id: currentId, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');

      invalidateCatalogoServicosClientCache();
      const raw = (data.servico ??
        (data.id ? { ...payload, id: data.id, foto_urls: liveItem?.foto_urls ?? [] } : null)) as
        | CatalogoItem
        | null;
      if (!raw?.id) throw new Error('Resposta inválida ao salvar');
      const saved = normalizeItem(raw);

      onItemUpserted(saved, isCreate);
      if (isCreate) {
        setLiveItem(saved);
        setShowPostCreateFotosHint(true);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function handleFotosChange(foto_urls: string[]) {
    if (!liveItem) return;
    const next = { ...liveItem, foto_urls };
    setLiveItem(next);
    onFotosChange(liveItem.id, foto_urls);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {liveItem || editing ? `Editar ${formTipoLabel}` : `Novo ${formTipoLabel}`}
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>
        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <form onSubmit={handleSave} className="space-y-4">
          {!liveItem && !editing && (
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
              placeholder={
                form.tipo === 'produto' ? 'Ex.: Shampoo profissional' : 'Ex.: Corte feminino'
              }
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

          {liveItem?.id ? (
            <>
              {showPostCreateFotosHint && (
                <p className="border-t border-gray-100 pt-3 text-xs text-green-700">
                  Item salvo. Adicione fotos abaixo ou feche o formulário quando terminar.
                </p>
              )}
              <FotosEditor
                key={liveItem.id}
                item={liveItem}
                onChange={handleFotosChange}
                onPreview={(index) =>
                  onPreviewFotos(liveItem.foto_urls, index, liveItem.nome)
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
              onClick={onClose}
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
  );
}

export default memo(CatalogoServicoFormModal);
