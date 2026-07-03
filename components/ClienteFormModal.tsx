'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import AnamnesePublicFields from '@/components/AnamnesePublicFields';
import type { AnamneseCampo } from '@/lib/anamnese';
import { anamneseValuesFromDetalhe } from '@/lib/clienteFicha';
import type { ClienteDetalheEnriquecido } from '@/lib/clienteFicha';
import {
  isInternationalPhoneInput,
  isValidPhone,
  mascaraTelefoneInput,
  phoneInputPlaceholder,
  telefoneParaInputEdit,
} from '@/lib/phoneMatch';
import { PHONE_INTL_HINT } from '@/lib/constants';

export type ClienteFormSeed = {
  id?: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  cpf?: string | null;
  data_nascimento?: string | null;
  observacoes_gerais?: string | null;
  anamnese_respostas?: Record<string, string | boolean> | null;
  atendimentos?: unknown[];
};

type FormState = {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  data_nascimento: string;
  observacoes_gerais: string;
};

const emptyForm: FormState = {
  nome: '',
  email: '',
  telefone: '',
  cpf: '',
  data_nascimento: '',
  observacoes_gerais: '',
};

function seedToForm(
  seed: ClienteFormSeed | ClienteDetalheEnriquecido | null,
): FormState {
  if (!seed) return emptyForm;
  return {
    nome: seed.nome ?? '',
    email: seed.email ?? '',
    telefone: seed.telefone ? telefoneParaInputEdit(String(seed.telefone)) : '',
    cpf: seed.cpf ?? '',
    data_nascimento: seed.data_nascimento ?? '',
    observacoes_gerais:
      'observacoes_gerais' in seed ? (seed.observacoes_gerais ?? '') : '',
  };
}

type Props = {
  open: boolean;
  editingClienteId: string | null;
  seed: ClienteFormSeed | null;
  googleImportResourceName: string | null;
  anamneseCampos: AnamneseCampo[];
  onClose: () => void;
  onSaved: (result: {
    id: string;
    cliente?: ClienteDetalheEnriquecido;
    editing: boolean;
  }) => void | Promise<void>;
};

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function ClienteFormModal({
  open,
  editingClienteId,
  seed,
  googleImportResourceName,
  anamneseCampos,
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [anamneseValues, setAnamneseValues] = useState<
    Record<string, string | boolean>
  >({});
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [telefoneErro, setTelefoneErro] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const fetchGenRef = useRef(0);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    dirtyRef.current = false;
    fetchGenRef.current += 1;
    setErro(null);
    setTelefoneErro(null);
    setSaving(false);
    savingRef.current = false;
    setForm(seedToForm(seed));
    setAnamneseValues(
      anamneseCampos.length > 0 && seed && 'anamnese_respostas' in seed
        ? anamneseValuesFromDetalhe(
            seed as ClienteDetalheEnriquecido,
            anamneseCampos,
          )
        : {},
    );

    if (!editingClienteId) {
      setLoadingEdit(false);
      return;
    }

    const jaTemFichaCompleta =
      seed &&
      'atendimentos' in seed &&
      Array.isArray(seed.atendimentos);
    if (jaTemFichaCompleta) {
      setLoadingEdit(false);
      return;
    }

    setLoadingEdit(true);
    const fetchGen = fetchGenRef.current;
    void (async () => {
      try {
        const res = await fetch(`/api/clientes/${editingClienteId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar cliente');
        if (fetchGen !== fetchGenRef.current || dirtyRef.current) return;
        const det = data.cliente as ClienteDetalheEnriquecido;
        setForm(seedToForm(det));
        setAnamneseValues(
          anamneseCampos.length > 0
            ? anamneseValuesFromDetalhe(det, anamneseCampos)
            : {},
        );
      } catch (err: unknown) {
        if (fetchGen !== fetchGenRef.current) return;
        setErro(err instanceof Error ? err.message : 'Erro ao carregar');
      } finally {
        if (fetchGen === fetchGenRef.current) setLoadingEdit(false);
      }
    })();
  }, [open, editingClienteId, seed, anamneseCampos]);

  if (!open || typeof document === 'undefined') return null;

  const patchForm = (patch: Partial<FormState>) => {
    dirtyRef.current = true;
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;

    const telTrim = form.telefone.trim();
    if (telTrim && !isValidPhone(telTrim)) {
      setTelefoneErro(
        'Informe um telefone válido (DDD + número ou + código do país).',
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setErro(null);
    setTelefoneErro(null);
    try {
      if (googleImportResourceName && !editingClienteId) {
        const res = await fetch('/api/clientes/import-google-contatos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contatos: [
              {
                nome: form.nome,
                email: form.email || null,
                telefone: form.telefone.trim() || null,
                data_nascimento: form.data_nascimento || null,
                googleResourceName: googleImportResourceName,
              },
            ],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao importar');
        const id = data.clientes?.[0]?.id as string | undefined;
        if (id) await onSaved({ id, editing: false });
        onClose();
        return;
      }

      const url = editingClienteId
        ? `/api/clientes/${editingClienteId}`
        : '/api/clientes';
      const method = editingClienteId ? 'PUT' : 'POST';
      const payload: Record<string, unknown> = {
        nome: form.nome,
        email: form.email,
        telefone: form.telefone.trim(),
        cpf: form.cpf,
        data_nascimento: form.data_nascimento,
        observacoes_gerais: form.observacoes_gerais,
      };
      if (Object.keys(anamneseValues).length > 0) {
        payload.anamnese_respostas = anamneseValues;
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      if (data.reutilizado && data.aviso_duplicata?.mensagem) {
        alert(data.aviso_duplicata.mensagem);
      }
      const id = (data.cliente?.id as string | undefined) ?? editingClienteId;
      if (id) {
        await onSaved({
          id,
          cliente: data.cliente as ClienteDetalheEnriquecido | undefined,
          editing: !!editingClienteId,
        });
      }
      onClose();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-semibold">
            {editingClienteId ? 'Editar cliente' : 'Novo cliente'}
          </h3>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {erro && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {erro}
            </p>
          )}
          {loadingEdit && (
            <p className="text-xs text-gray-500 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Carregando ficha completa…
            </p>
          )}
          <Field label="Nome *" id="nome">
            <input
              id="nome"
              required
              value={form.nome}
              onChange={(e) => patchForm({ nome: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3795a1]"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Telefone / WhatsApp" id="tel">
              <input
                id="tel"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={phoneInputPlaceholder(form.telefone)}
                value={form.telefone}
                onChange={(e) => {
                  dirtyRef.current = true;
                  if (telefoneErro) setTelefoneErro(null);
                  setForm((prev) => ({
                    ...prev,
                    telefone: mascaraTelefoneInput(e.target.value, prev.telefone),
                  }));
                }}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3795a1] ${
                  telefoneErro ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
              />
              {telefoneErro && (
                <p className="text-xs text-red-600 mt-1">{telefoneErro}</p>
              )}
              {isInternationalPhoneInput(form.telefone) && (
                <p className="text-xs text-gray-500 mt-1">{PHONE_INTL_HINT}</p>
              )}
            </Field>
            <Field label="E-mail" id="email">
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => patchForm({ email: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3795a1]"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="CPF" id="cpf">
              <input
                id="cpf"
                value={form.cpf}
                onChange={(e) => patchForm({ cpf: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3795a1]"
              />
            </Field>
            <Field label="Nascimento" id="nasc">
              <input
                id="nasc"
                type="date"
                value={form.data_nascimento}
                onChange={(e) => patchForm({ data_nascimento: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3795a1]"
              />
            </Field>
          </div>
          {anamneseCampos.length > 0 && (
            <AnamnesePublicFields
              campos={anamneseCampos}
              values={anamneseValues}
              onChange={(id, value) => {
                dirtyRef.current = true;
                setAnamneseValues((prev) => ({ ...prev, [id]: value }));
              }}
              optional
            />
          )}
          <Field label="Observações gerais" id="obs">
            <textarea
              id="obs"
              rows={3}
              value={form.observacoes_gerais}
              onChange={(e) => patchForm({ observacoes_gerais: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3795a1]"
            />
          </Field>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-[#047482] text-white font-medium disabled:opacity-60 touch-manipulation"
            >
              {saving
                ? 'Salvando...'
                : editingClienteId
                  ? 'Salvar alterações'
                  : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default memo(ClienteFormModal);
