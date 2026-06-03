'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  MapPin,
  Save,
  ArrowLeft,
  Building2,
  Stethoscope,
  User,
  Phone,
  FileText,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Plus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import HealthPlanSelector from '@/components/HealthPlanSelector';
import ComunicacaoLinkCard from '@/components/ComunicacaoLinkCard';
import AssinaturaChangeCard from '@/components/AssinaturaChangeCard';
import {
  doctorsCountFromPlan,
  isValidPlanId,
  maxMedicosCadastrados,
  type PlanId,
} from '@/lib/subscriptionPlans';


// Interface do perfil vinda da API
interface Profile {
  id: string;
  email: string;
  user_type: 'medico' | 'clinica';
  plan: string;
  trial_started: boolean;
  onboarding_completed: boolean;
  full_name?: string;
  crm?: string;
  specialty?: string;
  clinic_name?: string;
  cnpj?: string;
  doctors_count?: number;
  whatsapp?: string;
  address?: string;
  health_plan?: string;
  cep?: string;
  street?: string;
  address_number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface EnderecoViaCEP {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

// Interface do médico da clínica
interface ClinicaMedico {
  id: string;
  clinica_email: string;
  nome: string;
  crm?: string;
  specialty?: string;
  whatsapp?: string;
  email?: string;
  created_at: string;
}

export default function PerfilPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchingCep, setSearchingCep] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Estados do formulário
  const [form, setForm] = useState({
    fullName: '',
    crm: '',
    specialty: '',
    clinicName: '',
    cnpj: '',
    whatsapp: '',
    healthPlan: '',
    cep: '',
    street: '',
    addressNumber: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    country: 'Brasil',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  // Carregar perfil
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.email) return;

    fetch('/api/perfil')
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setProfile(data.profile);
          const p = data.profile;
          setForm({
            fullName: p.full_name || '',
            crm: p.crm || '',
            specialty: p.specialty || '',
            clinicName: p.clinic_name || '',
            cnpj: p.cnpj ? aplicarMascaraCNPJ(p.cnpj) : '',
            whatsapp: p.whatsapp ? aplicarMascaraWhatsapp(p.whatsapp) : '',
            healthPlan: p.health_plan || '',
            cep: p.cep || '',
            street: p.street || '',
            addressNumber: p.address_number || '',
            complement: p.complement || '',
            neighborhood: p.neighborhood || '',
            city: p.city || '',
            state: p.state || '',
            country: p.country || 'Brasil',
          });
        }
      })
      .catch((err) => console.error('[perfil] Erro ao carregar:', err))
      .finally(() => setLoading(false));
  }, [status, session]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };

  // Buscar CEP via ViaCEP
  const handleSearchCep = useCallback(async () => {
    const cepLimpo = form.cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      setError('CEP deve ter 8 dígitos');
      return;
    }

    setSearchingCep(true);
    setError('');
    setSuccess('');

    try {
      // Tenta ViaCEP primeiro
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data: EnderecoViaCEP = await res.json();

      if (data.erro) {
        setError('CEP não encontrado');
        return;
      }

      setForm((prev) => ({
        ...prev,
        street: data.logradouro || prev.street,
        complement: data.complemento || prev.complement,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
        country: 'Brasil',
      }));

      setSuccess('Endereço preenchido automaticamente!');
    } catch {
      setError('Erro ao buscar CEP. Tente novamente.');
    } finally {
      setSearchingCep(false);
    }
  }, [form.cep]);

  // Máscaras
  function aplicarMascaraCNPJ(valor: string): string {
    const apenasNumeros = valor.replace(/\D/g, '').slice(0, 14);
    let mascara = apenasNumeros;
    if (apenasNumeros.length > 2) mascara = apenasNumeros.slice(0, 2) + '.' + apenasNumeros.slice(2);
    if (apenasNumeros.length > 5) mascara = mascara.slice(0, 6) + '.' + mascara.slice(6);
    if (apenasNumeros.length > 8) mascara = mascara.slice(0, 10) + '/' + mascara.slice(10);
    if (apenasNumeros.length > 12) mascara = mascara.slice(0, 15) + '-' + mascara.slice(15);
    return mascara;
  }

  function aplicarMascaraWhatsapp(valor: string): string {
    const apenasNumeros = valor.replace(/\D/g, '').slice(0, 11);
    let mascara = apenasNumeros;
    if (apenasNumeros.length > 0) mascara = '(' + apenasNumeros;
    if (apenasNumeros.length > 2) mascara = '(' + apenasNumeros.slice(0, 2) + ') ' + apenasNumeros.slice(2);
    if (apenasNumeros.length > 7) mascara = '(' + apenasNumeros.slice(0, 2) + ') ' + apenasNumeros.slice(2, 7) + '-' + apenasNumeros.slice(7);
    return mascara;
  }

  const handleSave = async () => {
    if (!session?.user?.email) {
      setError('Usuário não autenticado');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const body: Record<string, unknown> = {
        full_name: form.fullName,
        crm: form.crm,
        specialty: form.specialty,
        clinic_name: form.clinicName,
        cnpj: form.cnpj.replace(/\D/g, ''),
        whatsapp: form.whatsapp,
        health_plan: form.healthPlan,
        cep: form.cep.replace(/\D/g, ''),
        street: form.street,
        address_number: form.addressNumber,
        complement: form.complement,
        neighborhood: form.neighborhood,
        city: form.city,
        state: form.state,
        country: form.country,
      };

      const res = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar');
      }

      setSuccess('Perfil atualizado com sucesso!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  };

  const isMedico = profile?.user_type === 'medico';
  const planId = isValidPlanId(profile?.plan ?? '')
    ? (profile!.plan as PlanId)
    : null;
  const maxMedicosClinica = planId ? maxMedicosCadastrados(planId) : 5;
  const limitePlanoClinica = planId ? doctorsCountFromPlan(planId) : null;

  const reloadProfile = useCallback(() => {
    fetch('/api/perfil')
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) setProfile(data.profile);
      })
      .catch(() => {});
  }, []);

  if (!mounted || status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#228B22] mx-auto mb-4" />
          <p className="text-gray-500">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard" className="p-2 rounded-xl hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meu Perfil</h1>
          <p className="text-gray-500 mt-1">Gerencie suas informações profissionais e endereço</p>
        </div>
      </div>

      {/* Tipo de conta */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#90EE90]/20">
            {isMedico ? (
              <Stethoscope className="w-6 h-6 text-[#228B22]" />
            ) : (
              <Building2 className="w-6 h-6 text-[#228B22]" />
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              {isMedico ? 'Médico Solo' : 'Clínica'}
            </p>
            <p className="text-sm text-gray-500">
              Plano: {profile?.plan || 'Não definido'} • {session?.user?.email}
            </p>
          </div>
        </div>
      </div>

      <AssinaturaChangeCard onPlanChanged={reloadProfile} />

      <div className="mb-6">
        <ComunicacaoLinkCard />
      </div>

      {/* Mensagens */}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-red-50 border border-red-200 rounded-2xl text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-green-50 border border-green-200 rounded-2xl text-green-700">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{success}</p>
        </div>
      )}

      {/* Formulário */}
      <div className="space-y-6">
        {/* Seção: Dados Profissionais */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-[#228B22]" />
            <h2 className="text-xl font-semibold text-gray-900">Dados Profissionais</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isMedico ? (
              <>
                <label className="space-y-1.5 text-sm text-gray-700 md:col-span-2">
                  Nome completo
                  <input
                    value={form.fullName}
                    onChange={(e) => handleChange('fullName', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20"
                    placeholder="Dr. João Silva"
                  />
                </label>
                <label className="space-y-1.5 text-sm text-gray-700">
                  CRM
                  <input
                    value={form.crm}
                    onChange={(e) => handleChange('crm', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20"
                    placeholder="CRM 12345"
                  />
                </label>
                <label className="space-y-1.5 text-sm text-gray-700">
                  Especialidade
                  <input
                    value={form.specialty}
                    onChange={(e) => handleChange('specialty', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20"
                    placeholder="Dermatologista"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="space-y-1.5 text-sm text-gray-700 md:col-span-2">
                  Nome da clínica
                  <input
                    value={form.clinicName}
                    onChange={(e) => handleChange('clinicName', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20"
                    placeholder="Clínica Vida & Saúde"
                  />
                </label>
                <label className="space-y-1.5 text-sm text-gray-700">
                  CNPJ
                  <input
                    value={form.cnpj}
                    onChange={(e) => handleChange('cnpj', aplicarMascaraCNPJ(e.target.value))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20"
                    placeholder="00.000.000/0000-00"
                  />
                </label>
                <p className="text-sm text-gray-600 md:col-span-2 bg-[#f4fff4] border border-[#90EE90]/40 rounded-xl px-4 py-3">
                  Plano atual: cadastre até{' '}
                  <strong>{maxMedicosClinica} médicos</strong> na seção &quot;Médicos da Clínica&quot;
                  abaixo
                  {limitePlanoClinica
                    ? ` (limite operacional do plano: ${limitePlanoClinica}).`
                    : '.'}{' '}
                  Para mudar o limite, altere o plano em Assinatura acima.
                </p>
              </>
            )}

            <label className="space-y-1.5 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                WhatsApp
              </div>
              <input
                value={form.whatsapp}
                onChange={(e) => handleChange('whatsapp', aplicarMascaraWhatsapp(e.target.value))}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20"
                placeholder="(99) 99999-9999"
              />
            </label>

            <div className="md:col-span-2">
              <HealthPlanSelector
                value={form.healthPlan}
                onChange={(v) => handleChange('healthPlan', v)}
                label={
                  profile?.user_type === 'clinica'
                    ? 'Convênios que a clínica aceita'
                    : 'Convênios que você atende'
                }
              />
            </div>
          </div>
        </div>

        {/* Seção: Endereço */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="w-5 h-5 text-[#228B22]" />
            <h2 className="text-xl font-semibold text-gray-900">Endereço</h2>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Este endereço será usado na agenda para gerar links do Google Maps nos
            compromissos dos pacientes.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* CEP com busca automática */}
            <label className="space-y-1.5 text-sm text-gray-700">
              CEP
              <div className="flex gap-2">
                <input
                  value={form.cep}
                  onChange={(e) => handleChange('cep', e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onBlur={() => form.cep.replace(/\D/g, '').length === 8 && handleSearchCep()}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20"
                  placeholder="00000-000"
                  maxLength={8}
                />
                <button
                  type="button"
                  onClick={handleSearchCep}
                  disabled={searchingCep || form.cep.replace(/\D/g, '').length !== 8}
                  className="p-3 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition"
                  title="Buscar CEP"
                >
                  {searchingCep ? (
                    <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                  ) : (
                    <Search className="w-5 h-5 text-gray-500" />
                  )}
                </button>
              </div>
            </label>

            <label className="space-y-1.5 text-sm text-gray-700 md:col-span-2">
              Logradouro
              <input
                value={form.street}
                onChange={(e) => handleChange('street', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20"
                placeholder="Rua das Flores"
              />
            </label>

            <label className="space-y-1.5 text-sm text-gray-700">
              Número
              <input
                value={form.addressNumber}
                onChange={(e) => handleChange('addressNumber', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20"
                placeholder="123"
              />
            </label>

            <label className="space-y-1.5 text-sm text-gray-700">
              Complemento
              <input
                value={form.complement}
                onChange={(e) => handleChange('complement', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20"
                placeholder="Sala 101"
              />
            </label>

            <label className="space-y-1.5 text-sm text-gray-700">
              Bairro
              <input
                value={form.neighborhood}
                onChange={(e) => handleChange('neighborhood', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20"
                placeholder="Centro"
              />
            </label>

            <label className="space-y-1.5 text-sm text-gray-700">
              Cidade
              <input
                value={form.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20"
                placeholder="São Paulo"
              />
            </label>

            <label className="space-y-1.5 text-sm text-gray-700">
              Estado
              <select
                value={form.state}
                onChange={(e) => handleChange('state', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20"
              >
                <option value="">Selecione</option>
                {[
                  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
                  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
                  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
                ].map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-sm text-gray-700">
              País
              <input
                value={form.country}
                onChange={(e) => handleChange('country', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20"
              />
            </label>
          </div>
        </div>

        {/* Seção: Médicos da Clínica (apenas para clínicas) */}
        {!isMedico && (
          <GestaoMedicos
            clinicaEmail={session?.user?.email || ''}
            maxMedicos={maxMedicosClinica}
          />
        )}

        {/* Botão Salvar */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-[#228B22] text-white px-8 py-3 rounded-2xl font-semibold hover:bg-[#1a6e1a] transition disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Componente de Gestão de Médicos (para clínicas)
// ============================================================
function GestaoMedicos({
  clinicaEmail,
  maxMedicos,
}: {
  clinicaEmail: string;
  maxMedicos: number;
}) {
  const [medicos, setMedicos] = useState<ClinicaMedico[]>([]);
  const [loadingMedicos, setLoadingMedicos] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [savingMedico, setSavingMedico] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [novoMedico, setNovoMedico] = useState({
    nome: '',
    crm: '',
    specialty: '',
    whatsapp: '',
    email: '',
  });

  // Carregar médicos
  const carregarMedicos = useCallback(async () => {
    try {
      const res = await fetch('/api/perfil/medicos');
      const data = await res.json();
      if (res.ok) {
        setMedicos(data.medicos || []);
      }
    } catch (err) {
      console.error('[GestaoMedicos] Erro ao carregar:', err);
    } finally {
      setLoadingMedicos(false);
    }
  }, []);

  useEffect(() => {
    carregarMedicos();
  }, [carregarMedicos]);

  // Adicionar médico
  const atLimit = medicos.length >= maxMedicos;

  const handleAdicionar = async () => {
    if (atLimit) {
      setError(`Limite do plano: até ${maxMedicos} médico(s) cadastrado(s).`);
      return;
    }
    if (!novoMedico.nome.trim()) {
      setError('Nome do médico é obrigatório');
      return;
    }

    setSavingMedico(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/perfil/medicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoMedico),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao adicionar médico');
      }

      setSuccess(`Médico "${novoMedico.nome}" adicionado com sucesso!`);
      setNovoMedico({ nome: '', crm: '', specialty: '', whatsapp: '', email: '' });
      setShowAddForm(false);
      carregarMedicos();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar médico');
    } finally {
      setSavingMedico(false);
    }
  };

  // Remover médico
  const handleRemover = async (id: string, nome: string) => {
    if (!confirm(`Remover médico "${nome}"? Esta ação não pode ser desfeita.`)) return;

    setDeletingId(id);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/perfil/medicos?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao remover médico');
      }

      setSuccess(`Médico "${nome}" removido com sucesso!`);
      carregarMedicos();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao remover médico');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-[#228B22]" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Médicos da Clínica</h2>
            <p className="text-xs text-gray-500">
              {medicos.length} de {maxMedicos} cadastrados
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={atLimit && !showAddForm}
          className="flex items-center gap-2 bg-[#228B22] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1a6e1a] transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {showAddForm ? 'Cancelar' : 'Adicionar'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-3 mb-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {/* Formulário de adicionar médico */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-3">Novo Médico</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1 text-sm text-gray-600 md:col-span-2">
              Nome *
              <input
                value={novoMedico.nome}
                onChange={(e) => setNovoMedico((p) => ({ ...p, nome: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20 text-sm"
                placeholder="Dr. Carlos Pereira"
              />
            </label>
            <label className="space-y-1 text-sm text-gray-600">
              CRM
              <input
                value={novoMedico.crm}
                onChange={(e) => setNovoMedico((p) => ({ ...p, crm: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20 text-sm"
                placeholder="CRM 67890"
              />
            </label>
            <label className="space-y-1 text-sm text-gray-600">
              Especialidade
              <input
                value={novoMedico.specialty}
                onChange={(e) => setNovoMedico((p) => ({ ...p, specialty: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20 text-sm"
                placeholder="Cardiologista"
              />
            </label>
            <label className="space-y-1 text-sm text-gray-600">
              WhatsApp
              <input
                value={novoMedico.whatsapp}
                onChange={(e) => setNovoMedico((p) => ({ ...p, whatsapp: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20 text-sm"
                placeholder="(99) 99999-9999"
              />
            </label>
            <label className="space-y-1 text-sm text-gray-600">
              E-mail
              <input
                value={novoMedico.email}
                onChange={(e) => setNovoMedico((p) => ({ ...p, email: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-[#228B22] focus:ring-1 focus:ring-[#228B22]/20 text-sm"
                placeholder="carlos@clinica.com"
              />
            </label>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={handleAdicionar}
              disabled={savingMedico}
              className="bg-[#228B22] text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-[#1a6e1a] transition disabled:opacity-50 flex items-center gap-2"
            >
              {savingMedico ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {savingMedico ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setNovoMedico({ nome: '', crm: '', specialty: '', whatsapp: '', email: '' }); }}
              className="px-6 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de médicos */}
      {loadingMedicos ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : medicos.length === 0 ? (
        <p className="text-gray-400 text-sm py-6 text-center">
          Nenhum médico cadastrado. Clique em "Adicionar" para incluir.
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {medicos.map((medico) => (
            <div key={medico.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{medico.nome}</p>
                <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                  {medico.crm && <span>CRM: {medico.crm}</span>}
                  {medico.specialty && <span>{medico.specialty}</span>}
                  {medico.whatsapp && <span>{medico.whatsapp}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemover(medico.id, medico.nome)}
                disabled={deletingId === medico.id}
                className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition disabled:opacity-50"
                title="Remover médico"
              >
                {deletingId === medico.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
