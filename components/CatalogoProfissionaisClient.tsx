'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Plus, Pencil, Trash2, X, Calendar } from 'lucide-react';
import { aplicarMascaraWhatsapp } from '@/lib/constants';
import { formatarTelefoneBr } from '@/lib/phoneMatch';
import {
  validatePercentualComissao,
  validateProfissionalEmail,
  validateProfissionalWhatsapp,
} from '@/lib/profissionaisValidation';
import { normalizeCorAgenda, colorsFromCorAgenda } from '@/lib/agendaProfissionalColors';
import CorAgendaPicker from '@/components/CorAgendaPicker';
import { isMobileDevice, openWhatsAppUrl, preOpenExternalTab } from '@/lib/openExternalUrl';

const API = '/api/catalogo/profissionais';
const INVITE_API = '/api/perfil/medicos/invite-agenda';

type Profissional = {
  id: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  percentual_comissao: number | null;
  cor_agenda?: string | null;
  agenda_google_status?: 'connected' | 'pending' | null;
};

type FormState = {
  nome: string;
  whatsapp: string;
  email: string;
  percentual_comissao: string;
  cor_agenda: string | null;
};

const emptyForm: FormState = {
  nome: '',
  whatsapp: '',
  email: '',
  percentual_comissao: '50',
  cor_agenda: null,
};

function profissionalToForm(p: Profissional): FormState {
  return {
    nome: p.nome,
    whatsapp: p.whatsapp ? formatarTelefoneBr(p.whatsapp) : '',
    email: p.email ?? '',
    percentual_comissao: String(p.percentual_comissao ?? 50),
    cor_agenda: p.cor_agenda ?? null,
  };
}

function agendaStatusLabel(status: Profissional['agenda_google_status']): string {
  if (status === 'connected') return 'Conectada';
  if (status === 'pending') return 'Pendente';
  return '—';
}

function agendaStatusClass(status: Profissional['agenda_google_status']): string {
  if (status === 'connected') return 'text-emerald-700 bg-emerald-50';
  if (status === 'pending') return 'text-amber-700 bg-amber-50';
  return 'text-gray-400';
}

export default function CatalogoProfissionaisClient() {
  const [lista, setLista] = useState<Profissional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Profissional | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [inviteLoading, setInviteLoading] = useState<string | null>(null);
  const [nomeSalao, setNomeSalao] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const res = await fetch(API);
      const data = await res.json();
      if (res.status === 403) {
        setForbidden(true);
        setLista([]);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar');
      const rows = (data.profissionais ?? data.medicos ?? []) as Profissional[];
      setLista(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/perfil');
        const data = await res.json();
        if (res.ok && data.profile) {
          setNomeSalao(data.profile.clinic_name || data.profile.full_name || null);
        }
      } catch {
        /* nome do salão é opcional na mensagem */
      }
    })();
  }, []);

  async function openInviteWhatsApp(profissional: Profissional) {
    if (!profissional.whatsapp || validateProfissionalWhatsapp(profissional.whatsapp)) return;

    const preOpened = isMobileDevice() ? null : preOpenExternalTab();
    setInviteLoading(profissional.id);
    try {
      const res = await fetch(INVITE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: profissional.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar convite');

      if (data.whatsapp_url) {
        openWhatsAppUrl(data.whatsapp_url, {
          appUrl: data.whatsapp_app_url as string | undefined,
          androidUrl: data.whatsapp_android_url as string | undefined,
          preOpened,
        });
      }

      setLista((list) =>
        list.map((p) =>
          p.id === profissional.id ? { ...p, agenda_google_status: 'pending' as const } : p,
        ),
      );
    } catch (err) {
      preOpened?.close();
      alert(err instanceof Error ? err.message : 'Erro ao gerar convite');
    } finally {
      setInviteLoading(null);
    }
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEdit(p: Profissional) {
    setEditing(p);
    setForm(profissionalToForm(p));
    setFieldErrors({});
    setModalOpen(true);
  }

  function validateForm(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.nome.trim()) errs.nome = 'Nome é obrigatório';
    const wErr = validateProfissionalWhatsapp(form.whatsapp);
    if (wErr) errs.whatsapp = wErr;
    const eErr = validateProfissionalEmail(form.email);
    if (eErr) errs.email = eErr;
    const pErr = validatePercentualComissao(form.percentual_comissao);
    if (pErr) errs.percentual_comissao = pErr;
    if (form.cor_agenda && !normalizeCorAgenda(form.cor_agenda)) {
      errs.cor_agenda = 'Cor inválida (use #RRGGBB)';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    setError(null);
    const payload = {
      nome: form.nome.trim(),
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      percentual_comissao: Number(form.percentual_comissao),
      cor_agenda: form.cor_agenda,
    };

    try {
      const res = await fetch(API, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');

      const saved = (data.profissional ?? data.medico) as Profissional;
      if (editing) {
        setLista((list) => list.map((p) => (p.id === saved.id ? saved : p)));
      } else {
        setLista((list) =>
          [...list, saved].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
        );
      }
      setModalOpen(false);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Remover profissional "${nome}"?`)) return;
    try {
      const res = await fetch(`${API}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao remover');
      setLista((list) => list.filter((p) => p.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    }
  }

  if (forbidden) {
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Não foi possível carregar a gestão de profissionais. Verifique sua assinatura ou tente
        novamente.
      </p>
    );
  }

  const canInviteFromModal =
    modalOpen &&
    editing &&
    form.whatsapp &&
    !validateProfissionalWhatsapp(form.whatsapp) &&
    editing.agenda_google_status !== 'connected';

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-500">
            Cadastre a equipe do salão — nome, contatos, comissão e agenda Google.
          </p>
        </div>
        <button
          type="button"
          data-tour="catalogo-nova-profissional"
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-xl bg-[#047482] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#035e6b]"
        >
          <Plus className="h-4 w-4" />
          Nova profissional
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-sm text-gray-500">Carregando...</p>
        ) : lista.length === 0 ? (
          <p
            className="p-8 text-center text-sm text-gray-500"
            data-tour="catalogo-cor-agenda"
          >
            Nenhuma profissional cadastrada. Clique em &quot;Nova profissional&quot; para começar —
            ao salvar, escolha a cor dela na agenda.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">WhatsApp</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Comissão</th>
                <th className="px-4 py-3" data-tour="catalogo-cor-agenda">
                  Cor
                </th>
                <th className="px-4 py-3">Agenda Google</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const canInvite =
                  p.whatsapp &&
                  !validateProfissionalWhatsapp(p.whatsapp) &&
                  p.agenda_google_status !== 'connected';
                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.nome}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.whatsapp ? formatarTelefoneBr(p.whatsapp) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-900">
                      {p.percentual_comissao != null ? `${p.percentual_comissao}%` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const swatch = p.cor_agenda
                          ? colorsFromCorAgenda(p.cor_agenda)
                          : null;
                        return swatch ? (
                          <span
                            className="inline-block h-6 w-6 rounded-md border-2"
                            style={{
                              backgroundColor: swatch.background,
                              borderColor: swatch.border,
                            }}
                            title={p.cor_agenda ?? undefined}
                          />
                        ) : (
                          <span className="text-xs text-gray-400">Auto</span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${agendaStatusClass(p.agenda_google_status)}`}
                      >
                        {agendaStatusLabel(p.agenda_google_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canInvite && (
                        <button
                          type="button"
                          onClick={() => void openInviteWhatsApp(p)}
                          disabled={inviteLoading === p.id}
                          className="p-1.5 text-[#25D366] hover:text-[#20bd5a] disabled:opacity-50"
                          title="Pedir acesso à agenda Google"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="p-1.5 text-gray-400 hover:text-[var(--brand-primary)]"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id, p.nome)}
                        className="p-1.5 text-gray-400 hover:text-red-600"
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Editar profissional' : 'Nova profissional'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-gray-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nome *</label>
                <input
                  required
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm ${
                    fieldErrors.nome ? 'border-red-400 bg-red-50' : 'border-gray-200'
                  }`}
                  placeholder="Ex.: Ana Silva"
                />
                {fieldErrors.nome && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.nome}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">WhatsApp</label>
                <input
                  value={form.whatsapp}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, whatsapp: aplicarMascaraWhatsapp(e.target.value) }))
                  }
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm ${
                    fieldErrors.whatsapp ? 'border-red-400 bg-red-50' : 'border-gray-200'
                  }`}
                  placeholder="(99) 99999-9999"
                />
                {fieldErrors.whatsapp && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.whatsapp}</p>
                )}
                {canInviteFromModal && editing && (
                  <>
                    <button
                      type="button"
                      onClick={() => void openInviteWhatsApp(editing)}
                      disabled={inviteLoading === editing.id}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-medium text-white hover:bg-[#20bd5a] disabled:opacity-50"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Pedir acesso à agenda
                    </button>
                    <p className="mt-1.5 text-xs text-gray-500">
                      Envia um link para a profissional autorizar só a agenda Google no Turquesa
                      Agenda{nomeSalao ? ` (${nomeSalao})` : ''}.
                    </p>
                  </>
                )}
                {editing?.agenda_google_status === 'connected' && (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-emerald-700">
                    <Calendar className="h-3.5 w-3.5" />
                    Agenda Google conectada
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">E-mail</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm ${
                    fieldErrors.email ? 'border-red-400 bg-red-50' : 'border-gray-200'
                  }`}
                  placeholder="ana@exemplo.com"
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Comissão padrão (%) *
                </label>
                <input
                  required
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.percentual_comissao}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, percentual_comissao: e.target.value }))
                  }
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm ${
                    fieldErrors.percentual_comissao
                      ? 'border-red-400 bg-red-50'
                      : 'border-gray-200'
                  }`}
                />
                {fieldErrors.percentual_comissao && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.percentual_comissao}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Usada no financeiro ao registrar atendimentos desta profissional.
                </p>
              </div>
              <CorAgendaPicker
                value={form.cor_agenda}
                onChange={(cor_agenda) => setForm((f) => ({ ...f, cor_agenda }))}
                error={fieldErrors.cor_agenda}
              />
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
                  className="flex-1 rounded-xl bg-[#047482] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
