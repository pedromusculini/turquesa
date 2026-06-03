'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import CatalogoPublicoShowcase from '@/components/CatalogoPublicoShowcase';
import AnamnesePublicFields from '@/components/AnamnesePublicFields';
import MedicoPublicoPicker from '@/components/MedicoPublicoPicker';
import type { MedicoPublico } from '@/lib/medicosPublicos';
import { validateMedicoPublico } from '@/lib/medicosPublicos';
import type { AnamneseCampo } from '@/lib/anamnese';
import { cpfValidationMessage, formatCpf } from '@/lib/cpf';
import { aplicarMascaraWhatsapp } from '@/lib/constants';
import { brPhoneLocalDigits } from '@/lib/phoneMatch';

export default function FormularioPublicoPage() {
  const params = useParams();
  const token = params.token as string;

  const [titulo, setTitulo] = useState('Cadastre-se');
  const [nomeSalao, setNomeSalao] = useState('');
  const [descricao, setDescricao] = useState('Preencha seus dados com segurança.');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dataConsent, setDataConsent] = useState(false);
  const [medicos, setMedicos] = useState<MedicoPublico[]>([]);
  const [isClinica, setIsClinica] = useState(false);
  const [medico, setMedico] = useState('');
  const [medicoErro, setMedicoErro] = useState<string | undefined>();
  const [anamneseCampos, setAnamneseCampos] = useState<AnamneseCampo[]>([]);
  const [anamneseValues, setAnamneseValues] = useState<Record<string, string | boolean>>({});
  const [servicoCatalogoId, setServicoCatalogoId] = useState<string | null>(null);
  const [autorizacaoImagem, setAutorizacaoImagem] = useState<boolean | null>(null);

  const [form, setForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    data_nascimento: '',
    observacoes: '',
  });

  useEffect(() => {
    fetch(`/api/formulario/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setLoadError(data.error);
        else {
          if (data.titulo) setTitulo(data.titulo);
          if (data.nome_salao) setNomeSalao(data.nome_salao);
          if (data.descricao) setDescricao(data.descricao);
          if (Array.isArray(data.medicos)) setMedicos(data.medicos);
          if (data.is_clinica) setIsClinica(true);
          if (Array.isArray(data.anamnese_campos)) setAnamneseCampos(data.anamnese_campos);
        }
      })
      .catch(() => setLoadError('Não foi possível carregar o formulário'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!dataConsent) {
      setErro('Aceite o aviso de privacidade para enviar seus dados.');
      return;
    }

    if (brPhoneLocalDigits(form.telefone).length < 10) {
      setErro('Informe um telefone válido com DDD.');
      return;
    }

    const cpfErr = cpfValidationMessage(form.cpf);
    if (cpfErr) {
      setErro(cpfErr);
      return;
    }

    if (autorizacaoImagem !== true && autorizacaoImagem !== false) {
      setErro('Informe se autoriza ou não o uso de imagens para divulgação.');
      return;
    }

    for (const campo of anamneseCampos) {
      if (!campo.obrigatorio) continue;
      const v = anamneseValues[campo.id];
      if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
        setErro(`Preencha o campo "${campo.label}".`);
        return;
      }
    }

    const medErr = validateMedicoPublico({ isClinica, medicos }, medico);
    if (medErr) {
      setMedicoErro(medErr);
      return;
    }
    setMedicoErro(undefined);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/formulario/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          medico,
          dataConsent: true,
          servico_catalogo_id: servicoCatalogoId,
          autorizacao_imagem: autorizacaoImagem,
          anamnese_respostas: anamneseValues,
        }),
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

  if (loadError && !enviado) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <p className="text-red-600">{loadError}</p>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">Dados enviados!</h1>
        <p className="text-gray-600 mt-2">
          {nomeSalao
            ? `O salão ${nomeSalao} receberá suas informações em breve.`
            : 'O salão receberá suas informações em breve.'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-6 py-10">
      <CatalogoPublicoShowcase
        token={token}
        selectedId={servicoCatalogoId}
        onSelect={setServicoCatalogoId}
      />

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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone *</label>
            <input
              required
              type="tel"
              value={form.telefone}
              onChange={(e) =>
                setForm({ ...form, telefone: aplicarMascaraWhatsapp(e.target.value) })
              }
              placeholder="(00) 00000-0000"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CPF *</label>
            <input
              required
              inputMode="numeric"
              value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: formatCpf(e.target.value) })}
              placeholder="000.000.000-00"
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de nascimento</label>
            <input
              type="date"
              value={form.data_nascimento}
              onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
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
                ? 'Com qual profissional você prefere ser atendido(a)?'
                : undefined
            }
          />
          <AnamnesePublicFields
            campos={anamneseCampos}
            values={anamneseValues}
            onChange={(id, value) =>
              setAnamneseValues((prev) => ({ ...prev, [id]: value }))
            }
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              rows={3}
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="Preferências, alergias ou outras informações"
            />
          </div>

          <fieldset className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
            <legend className="text-sm font-medium text-gray-900 px-1">
              Uso de imagens para divulgação *
            </legend>
            <p className="mb-3 text-xs text-gray-500">
              Autorizo o salão a usar minhas fotos em redes sociais e materiais de marketing.
            </p>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="autorizacao_imagem"
                  checked={autorizacaoImagem === true}
                  onChange={() => setAutorizacaoImagem(true)}
                />
                Aceito
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="autorizacao_imagem"
                  checked={autorizacaoImagem === false}
                  onChange={() => setAutorizacaoImagem(false)}
                />
                Não aceito
              </label>
            </div>
          </fieldset>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={dataConsent}
              onChange={(e) => setDataConsent(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-[#228B22]"
            />
            <span>
              Autorizo o envio dos meus dados ao salão responsável por este link, para cadastro e
              contato, conforme a{' '}
              <Link href="/privacidade" target="_blank" className="text-[#228B22] hover:underline">
                Política de Privacidade
              </Link>
              . Os dados serão armazenados na conta Google do profissional, não na nuvem do
              Turquesa Agenda.
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
      <p className="text-center text-xs text-gray-400 mt-6">Turquesa Agenda · Dados protegidos (LGPD)</p>
    </div>
  );
}
