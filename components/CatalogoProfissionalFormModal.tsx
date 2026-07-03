'use client';

import { memo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, MessageCircle, X } from 'lucide-react';
import {
  MOBILE_MODAL_OVERLAY,
  MOBILE_MODAL_SHEET,
  useBodyScrollLock,
} from '@/lib/useBodyScrollLock';
import { aplicarMascaraWhatsapp } from '@/lib/constants';
import { formatarTelefoneBr } from '@/lib/phoneMatch';
import {
  validatePercentualComissao,
  validateProfissionalEmail,
  validateProfissionalWhatsapp,
} from '@/lib/profissionaisValidation';
import { normalizeCorAgenda } from '@/lib/agendaProfissionalColors';
import CorAgendaPicker from '@/components/CorAgendaPicker';

const API = '/api/catalogo/profissionais';

export type CatalogoProfissional = {
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

function profissionalToForm(p: CatalogoProfissional): FormState {
  return {
    nome: p.nome,
    whatsapp: p.whatsapp ? formatarTelefoneBr(p.whatsapp) : '',
    email: p.email ?? '',
    percentual_comissao: String(p.percentual_comissao ?? 50),
    cor_agenda: p.cor_agenda ?? null,
  };
}

type Props = {
  open: boolean;
  editing: CatalogoProfissional | null;
  nomeSalao: string | null;
  inviteLoading: boolean;
  onClose: () => void;
  onSaved: (profissional: CatalogoProfissional, editing: boolean) => void;
  onInvite: (profissional: CatalogoProfissional) => void;
};

function CatalogoProfissionalFormModal({
  open,
  editing,
  nomeSalao,
  inviteLoading,
  onClose,
  onSaved,
  onInvite,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? profissionalToForm(editing) : emptyForm);
    setFieldErrors({});
    setSaving(false);
    setError(null);
  }, [open, editing]);

  if (!open || typeof document === 'undefined') return null;

  const canInvite =
    !!editing &&
    !!form.whatsapp &&
    !validateProfissionalWhatsapp(form.whatsapp) &&
    editing.agenda_google_status !== 'connected';

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

      const saved = (data.profissional ?? data.medico) as CatalogoProfissional;
      onSaved(saved, !!editing);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className={MOBILE_MODAL_OVERLAY}>
      <div className={`${MOBILE_MODAL_SHEET} max-w-md p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {editing ? 'Editar profissional' : 'Nova profissional'}
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>
        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
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
                setForm((f) => ({
                  ...f,
                  whatsapp: aplicarMascaraWhatsapp(e.target.value),
                }))
              }
              className={`w-full rounded-xl border px-3 py-2.5 text-sm ${
                fieldErrors.whatsapp ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
              placeholder="(99) 99999-9999"
            />
            {fieldErrors.whatsapp && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.whatsapp}</p>
            )}
            {canInvite && editing && (
              <>
                <button
                  type="button"
                  onClick={() => onInvite(editing)}
                  disabled={inviteLoading}
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
              onClick={onClose}
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
    </div>,
    document.body,
  );
}

export default memo(CatalogoProfissionalFormModal);
