'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Plus, Pencil, Trash2, X, Upload, ImageIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import {
  CATALOGO_FOTO_MAX_COUNT,
  validateCatalogoFotoClient,
} from '@/lib/catalogoFotos';

type Servico = {
  id: string;
  nome: string;
  duracao_minutos: number;
  preco_centavos: number;
  ativo: boolean;
  foto_urls: string[];
};

type FormState = {
  nome: string;
  duracao_minutos: string;
  preco: string;
  ativo: boolean;
};

const emptyForm: FormState = {
  nome: '',
  duracao_minutos: '30',
  preco: '',
  ativo: true,
};

function FotoThumbs({ urls }: { urls: string[] }) {
  if (!urls.length) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <ImageIcon className="h-3.5 w-3.5" /> Sem foto
      </span>
    );
  }
  return (
    <div className="flex gap-1">
      {urls.map((url) => (
        <div key={url} className="relative h-10 w-10 overflow-hidden rounded-lg bg-gray-100">
          <Image src={url} alt="" fill className="object-cover" sizes="40px" />
        </div>
      ))}
    </div>
  );
}

function FotosEditor({
  servico,
  onChange,
}: {
  servico: Servico;
  onChange: (foto_urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fotoError, setFotoError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    const clientErr = validateCatalogoFotoClient(file);
    if (clientErr) {
      setFotoError(clientErr);
      return;
    }
    if (servico.foto_urls.length >= CATALOGO_FOTO_MAX_COUNT) {
      setFotoError(`Máximo de ${CATALOGO_FOTO_MAX_COUNT} fotos por serviço.`);
      return;
    }

    setUploading(true);
    setFotoError(null);
    try {
      const fd = new FormData();
      fd.append('servico_id', servico.id);
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
      const q = new URLSearchParams({ servico_id: servico.id, url });
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
      <p className="mb-2 text-sm font-medium text-gray-700">Fotos do serviço</p>
      <p className="mb-3 text-xs text-gray-500">
        Até {CATALOGO_FOTO_MAX_COUNT} fotos, máximo 2 MB cada (JPEG, PNG ou WebP).
      </p>
      <div className="flex flex-wrap gap-2">
        {servico.foto_urls.map((url) => (
          <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-xl bg-gray-100">
            <Image src={url} alt="" fill className="object-cover" sizes="80px" />
            <button
              type="button"
              onClick={() => handleDelete(url)}
              className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
              title="Remover foto"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {servico.foto_urls.length < CATALOGO_FOTO_MAX_COUNT && (
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
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 text-xs text-gray-500 hover:border-teal-400 hover:text-teal-700 disabled:opacity-50"
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

export default function CatalogoServicosClient() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Servico | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/catalogo/servicos');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar');
      setServicos(
        (data.servicos ?? []).map((s: Servico) => ({
          ...s,
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

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(s: Servico) {
    setEditing(s);
    setForm({
      nome: s.nome,
      duracao_minutos: String(s.duracao_minutos),
      preco: (s.preco_centavos / 100).toFixed(2).replace('.', ','),
      ativo: s.ativo,
    });
    setModalOpen(true);
  }

  function patchEditingFotos(foto_urls: string[]) {
    if (!editing) return;
    const next = { ...editing, foto_urls };
    setEditing(next);
    setServicos((list) => list.map((s) => (s.id === editing.id ? next : s)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const precoNum = parseFloat(form.preco.replace(',', '.')) || 0;
    const payload = {
      nome: form.nome.trim(),
      duracao_minutos: Math.max(1, parseInt(form.duracao_minutos, 10) || 30),
      preco_centavos: Math.round(precoNum * 100),
      ativo: form.ativo,
    };
    try {
      const res = await fetch('/api/catalogo/servicos', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      setModalOpen(false);
      await load();
      if (!editing && data.servico?.id) {
        const created = data.servico as Servico;
        setEditing({ ...created, foto_urls: [] });
        setModalOpen(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Remover serviço "${nome}"?`)) return;
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
    editing && servicos.find((s) => s.id === editing.id)
      ? servicos.find((s) => s.id === editing.id)!
      : editing;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de serviços</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cadastre os serviços oferecidos no salão — nome, duração, preço e fotos.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-xl bg-[#013a01] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#025201]"
        >
          <Plus className="h-4 w-4" />
          Novo serviço
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-gray-500">Carregando...</p>
        ) : servicos.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">
            Nenhum serviço cadastrado. Clique em &quot;Novo serviço&quot; para começar.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Fotos</th>
                <th className="px-4 py-3">Serviço</th>
                <th className="px-4 py-3">Duração</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {servicos.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <FotoThumbs urls={s.foto_urls} />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{s.nome}</td>
                  <td className="px-4 py-3 text-gray-600">{s.duracao_minutos} min</td>
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
                      className="p-1.5 text-gray-400 hover:text-teal-600"
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Editar serviço' : 'Novo serviço'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  required
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  placeholder="Ex.: Corte feminino"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$) *</label>
                  <input
                    required
                    value={form.preco}
                    onChange={(e) => setForm((f) => ({ ...f, preco: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                    placeholder="79,90"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                Serviço ativo (visível no catálogo público)
              </label>

              {editingLive ? (
                <FotosEditor servico={editingLive} onChange={patchEditingFotos} />
              ) : (
                <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
                  Salve o serviço para adicionar fotos.
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-[#013a01] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
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
