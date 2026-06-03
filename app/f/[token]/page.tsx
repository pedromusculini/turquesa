'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import ConvenioSelect from '@/components/ConvenioSelect';
import MedicoPublicoPicker from '@/components/MedicoPublicoPicker';
import type { MedicoPublico } from '@/lib/medicosPublicos';
import { validateMedicoPublico } from '@/lib/medicosPublicos';

export default function FormularioPublicoPage() {
  const params = useParams();
  const token = params.token as string;

  const [titulo, setTitulo] = useState('Cadastro de paciente');
  const [descricao, setDescricao] = useState('Preencha seus dados com segurança.');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dataConsent, setDataConsent] = useState(false);
  const [medicos, setMedicos] = useState<MedicoPublico[]>([]);
  const [isClinica, setIsClinica] = useState(false);
  const [medico, setMedico] = useState('');
  const [medicoErro, setMedicoErro] = useState<string | undefined>();

  const [form, setForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    data_nascimento: '',
    convenio: '',
    motivo_consulta: '',
    observacoes: '',
  });

  useEffect(() => {
    fetch(`/api/formulario/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setErro(data.error);
        else {
          if (data.titulo) setTitulo(data.titulo);
          if (data.descricao) setDescricao(data.descricao);
          if (Array.isArray(data.medicos)) setMedicos(data.medicos);
          if (data.is_clinica) setIsClinica(true);
        }
      })
      .catch(() => setErro('Não foi possível carregar o formulário'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dataConsent) {
      setErro('Aceite o aviso de privacidade para enviar seus dados.');
      return;
    }
    const medErr = validateMedicoPublico(
      { isClinica, medicos },
      medico,
    );
    if (medErr) {
      setMedicoErro(medErr);
      return;
    }
    setMedicoErro(undefined);
    setSubmitting(true);
    setErro(null);
    try {
      const res = await fetch(`/api/formulario/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, medico, dataConsent: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar');
      setEnviado(true);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#228B22]" />
      </div>
    );
  }

  if (erro && !enviado) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <p className="text-red-600">{erro}</p>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">Dados enviados!</h1>
        <p className="text-gray-600 mt-2">A clínica receberá suas informações em breve.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-6 py-10">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{titulo}</h1>
        <p className="text-sm text-gray-500 mb-6">{descricao}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
            <input
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
              <input
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nascimento</label>
              <input
                type="date"
                value={form.data_nascimento}
                onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <ConvenioSelect
            value={form.convenio}
            onChange={(convenio) => setForm({ ...form, convenio })}
            label="Seu convênio / plano de saúde"
          />
          <MedicoPublicoPicker
            medicos={medicos}
            isClinica={isClinica}
            value={medico}
            onChange={(nome) => {
              setMedico(nome);
              setMedicoErro(undefined);
            }}
            error={medicoErro}
            title="Profissional"
            hint={
              medicos.length > 1
                ? 'Informe com qual médico você deseja se consultar'
                : undefined
            }
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo da consulta</label>
            <input
              value={form.motivo_consulta}
              onChange={(e) => setForm({ ...form, motivo_consulta: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              rows={3}
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={dataConsent}
              onChange={(e) => setDataConsent(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-[#228B22]"
            />
            <span>
              Autorizo o envio dos meus dados à clínica/médico responsável por este link,
              para cadastro e contato, conforme a{' '}
              <Link href="/privacidade" target="_blank" className="text-[#228B22] hover:underline">
                Política de Privacidade
              </Link>
              . Os dados serão armazenados na conta Google do profissional, não na nuvem do MedSupAPP.
            </span>
          </label>
          <button
            type="submit"
            disabled={submitting || !dataConsent}
            className="w-full bg-[#013a01] text-white py-3 rounded-xl font-medium hover:bg-[#025201] disabled:opacity-60"
          >
            {submitting ? 'Enviando...' : 'Enviar dados'}
          </button>
        </form>
      </div>
      <p className="text-center text-xs text-gray-400 mt-6">MedSupAPP · Dados protegidos (LGPD)</p>
    </div>
  );
}
