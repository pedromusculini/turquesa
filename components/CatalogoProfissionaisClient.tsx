'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Plus, Pencil, Trash2, Calendar } from 'lucide-react';
import { validateProfissionalWhatsapp } from '@/lib/profissionaisValidation';
import { colorsFromCorAgenda } from '@/lib/agendaProfissionalColors';
import { isMobileDevice, openWhatsAppUrl, preOpenExternalTab } from '@/lib/openExternalUrl';
import CatalogoProfissionalFormModal, {
  type CatalogoProfissional,
} from '@/components/CatalogoProfissionalFormModal';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';

const API = '/api/catalogo/profissionais';
const INVITE_API = '/api/perfil/medicos/invite-agenda';

type Profissional = CatalogoProfissional;

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
  const toast = useToast();
  const { confirm } = useConfirm();
  const [lista, setLista] = useState<Profissional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Profissional | null>(null);
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
    setModalOpen(true);
  }

  function openEdit(p: Profissional) {
    setEditing(p);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleSaved(saved: Profissional, wasEditing: boolean) {
    if (wasEditing) {
      setLista((list) => list.map((p) => (p.id === saved.id ? saved : p)));
      toast.success('Profissional atualizada.');
    } else {
      setLista((list) =>
        [...list, saved].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      );
      toast.success('Profissional cadastrada.');
    }
    closeModal();
  }

  async function handleDelete(id: string, nome: string) {
    const ok = await confirm({
      title: 'Remover profissional',
      message: `Remover "${nome}" da equipe?`,
      confirmLabel: 'Remover',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`${API}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao remover');
      setLista((list) => list.filter((p) => p.id !== id));
      toast.success('Profissional removida.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover');
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

  return (
    <>
      <div className={modalOpen ? 'pointer-events-none select-none' : undefined}>
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
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <p
        className="mb-3 text-xs text-gray-500"
        data-tour="catalogo-cor-agenda"
      >
        Dica: ao cadastrar ou editar, escolha a cor de cada profissional na agenda.
      </p>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-gray-500">Carregando...</p>
        ) : lista.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">
            Nenhuma profissional cadastrada. Clique em &quot;Nova profissional&quot; para começar.
          </p>
        ) : (
          <>
            {/* Mobile: lista em cards com botões de ação confortáveis ao toque */}
            <ul className="divide-y divide-gray-100 md:hidden">
              {lista.map((p) => {
                const swatch = p.cor_agenda
                  ? colorsFromCorAgenda(p.cor_agenda)
                  : null;
                return (
                  <li key={p.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                            style={{
                              backgroundColor: swatch?.background ?? '#cbd5e1',
                            }}
                            title={p.cor_agenda ?? undefined}
                          />
                          <span className="font-semibold text-gray-900 text-base">{p.nome}</span>
                        </div>
                        <div className="space-y-1 text-xs text-gray-600">
                          <p>
                            <span className="font-medium text-gray-500">WhatsApp:</span>{' '}
                            {p.whatsapp || '—'}
                          </p>
                          <p>
                            <span className="font-medium text-gray-500">Comissão:</span>{' '}
                            {p.percentual_comissao != null ? `${p.percentual_comissao}%` : '—'}
                          </p>
                          <div className="pt-1">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${agendaStatusClass(p.agenda_google_status)}`}
                            >
                              <Calendar className="h-3 w-3" />
                              {agendaStatusLabel(p.agenda_google_status)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {p.whatsapp &&
                          !validateProfissionalWhatsapp(p.whatsapp) &&
                          p.agenda_google_status !== 'connected' && (
                            <button
                              type="button"
                              onClick={() => void openInviteWhatsApp(p)}
                              disabled={inviteLoading === p.id}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 text-[#25D366] hover:bg-green-50 disabled:opacity-50"
                              title="Pedir acesso à agenda"
                              aria-label={`Pedir acesso à agenda para ${p.nome}`}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 text-[#047482] hover:bg-slate-50"
                          title="Editar"
                          aria-label={`Editar ${p.nome}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(p.id, p.nome)}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 text-red-600 hover:bg-red-50"
                          title="Remover"
                          aria-label={`Remover ${p.nome}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Desktop: tabela com colunas */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">WhatsApp</th>
                    <th className="px-4 py-3">Comissão</th>
                    <th className="px-4 py-3">Agenda</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p) => {
                    const swatch = p.cor_agenda
                      ? colorsFromCorAgenda(p.cor_agenda)
                      : null;
                    return (
                      <tr key={p.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                              style={{
                                backgroundColor: swatch?.background ?? '#cbd5e1',
                              }}
                              title={p.cor_agenda ?? undefined}
                            />
                            <span className="font-medium text-gray-900">{p.nome}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{p.whatsapp || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {p.percentual_comissao != null ? `${p.percentual_comissao}%` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${agendaStatusClass(p.agenda_google_status)}`}
                          >
                            <Calendar className="h-3 w-3" />
                            {agendaStatusLabel(p.agenda_google_status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {p.whatsapp &&
                              !validateProfissionalWhatsapp(p.whatsapp) &&
                              p.agenda_google_status !== 'connected' && (
                                <button
                                  type="button"
                                  onClick={() => void openInviteWhatsApp(p)}
                                  disabled={inviteLoading === p.id}
                                  className="p-1.5 text-gray-400 hover:text-[#25D366] disabled:opacity-50"
                                  title="Pedir acesso à agenda"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </button>
                              )}
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              className="p-1.5 text-gray-400 hover:text-[#047482]"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(p.id, p.nome)}
                              className="p-1.5 text-gray-400 hover:text-red-600"
                              title="Remover"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      </div>

      <CatalogoProfissionalFormModal
        open={modalOpen}
        editing={editing}
        nomeSalao={nomeSalao}
        inviteLoading={inviteLoading === editing?.id}
        onClose={closeModal}
        onSaved={handleSaved}
        onInvite={(p) => void openInviteWhatsApp(p)}
      />
    </>
  );
}
