'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  MapPin,
  Save,
  ArrowLeft,
  User,
  Phone,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import AddToHomeScreenButton from '@/components/AddToHomeScreenButton';
import ComunicacaoLinkCard from '@/components/ComunicacaoLinkCard';
import {
  cpfCnpjValidationMessage,
  formatCpfCnpj,
  normalizeCpfCnpj,
} from '@/lib/cpfCnpj';


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
            cnpj: p.cnpj ? formatCpfCnpj(p.cnpj) : '',
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

    const docErr = cpfCnpjValidationMessage(form.cnpj);
    if (docErr) {
      setError(docErr);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const docDigits = normalizeCpfCnpj(form.cnpj);
      const body: Record<string, unknown> = {
        full_name: form.fullName,
        crm: form.crm,
        specialty: form.specialty,
        clinic_name: form.clinicName,
        cnpj: docDigits || null,
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

  if (!mounted || status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#047482] mx-auto mb-4" />
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
          <p className="text-gray-500 mt-1">
            {isMedico
              ? 'Gerencie seus dados profissionais e endereço'
              : 'Gerencie os dados do salão e o endereço de atendimento'}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <ComunicacaoLinkCard />
      </div>

      <div className="mb-6 md:hidden rounded-2xl border border-[#047482]/20 bg-[#eef4f5]/50 p-5">
        <h2 className="font-semibold text-gray-900">App na tela inicial</h2>
        <p className="mt-1 text-sm text-gray-600">
          Instale o Turquesa Agenda no celular para abrir como aplicativo nativo, com nosso ícone.
        </p>
        <div className="mt-4">
          <AddToHomeScreenButton variant="inline" />
        </div>
      </div>

      {/* Mensagens */}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-red-50 border border-red-200 rounded-2xl text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-[#D9F0F2] border border-[#3795a1]/40 rounded-2xl text-[#035e6b]">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{success}</p>
        </div>
      )}

      {/* Catálogo de serviços */}
      <div className="mb-6 rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-bg-onboarding)]/60 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Catálogo de serviços</h2>
            <p className="text-sm text-gray-600 mt-1">
              Cadastre cortes, coloração, unhas e demais serviços com preço e duração.
            </p>
          </div>
          <Link
            href="/dashboard/catalogo"
            className="inline-flex items-center justify-center rounded-xl bg-[#047482] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#035e6b]"
          >
            Abrir catálogo
          </Link>
        </div>
      </div>

      {/* Formulário */}
      <div className="space-y-6">
        {/* Seção: Dados do salão / profissional */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-[#047482]" />
            <h2 className="text-xl font-semibold text-gray-900">
              {isMedico ? 'Dados profissionais' : 'Dados do salão'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isMedico ? (
              <>
                <label className="space-y-1.5 text-sm text-gray-700 md:col-span-2">
                  Nome completo
                  <input
                    value={form.fullName}
                    onChange={(e) => handleChange('fullName', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#047482] focus:ring-1 focus:ring-[#047482]/20"
                    placeholder="Maria Silva"
                  />
                </label>
                <label className="space-y-1.5 text-sm text-gray-700 md:col-span-2">
                  Especialidade / serviços
                  <input
                    value={form.specialty}
                    onChange={(e) => handleChange('specialty', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#047482] focus:ring-1 focus:ring-[#047482]/20"
                    placeholder="Corte, coloração, manicure…"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="space-y-1.5 text-sm text-gray-700 md:col-span-2">
                  Nome do salão
                  <input
                    value={form.clinicName}
                    onChange={(e) => handleChange('clinicName', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#047482] focus:ring-1 focus:ring-[#047482]/20"
                    placeholder="Estúdio Turquesa"
                  />
                </label>
                <label className="space-y-1.5 text-sm text-gray-700 md:col-span-2">
                  CPF ou CNPJ
                  <input
                    value={form.cnpj}
                    onChange={(e) => handleChange('cnpj', formatCpfCnpj(e.target.value))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#047482] focus:ring-1 focus:ring-[#047482]/20"
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                  <span className="block text-xs text-gray-500 mt-1">
                    Opcional. MEI pode informar CPF ou CNPJ do titular.
                  </span>
                </label>
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
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#047482] focus:ring-1 focus:ring-[#047482]/20"
                placeholder="(99) 99999-9999"
              />
            </label>

          </div>
        </div>

        {/* Seção: Local de atendimento */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="w-5 h-5 text-[#047482]" />
            <h2 className="text-xl font-semibold text-gray-900">Local de atendimento</h2>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Este endereço será usado na agenda para gerar links do Google Maps nos
            compromissos dos clientes.
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
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#047482] focus:ring-1 focus:ring-[#047482]/20"
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
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#047482] focus:ring-1 focus:ring-[#047482]/20"
                placeholder="Rua das Flores"
              />
            </label>

            <label className="space-y-1.5 text-sm text-gray-700">
              Número
              <input
                value={form.addressNumber}
                onChange={(e) => handleChange('addressNumber', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#047482] focus:ring-1 focus:ring-[#047482]/20"
                placeholder="123"
              />
            </label>

            <label className="space-y-1.5 text-sm text-gray-700">
              Complemento
              <input
                value={form.complement}
                onChange={(e) => handleChange('complement', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#047482] focus:ring-1 focus:ring-[#047482]/20"
                placeholder="Sala 101"
              />
            </label>

            <label className="space-y-1.5 text-sm text-gray-700">
              Bairro
              <input
                value={form.neighborhood}
                onChange={(e) => handleChange('neighborhood', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#047482] focus:ring-1 focus:ring-[#047482]/20"
                placeholder="Centro"
              />
            </label>

            <label className="space-y-1.5 text-sm text-gray-700">
              Cidade
              <input
                value={form.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#047482] focus:ring-1 focus:ring-[#047482]/20"
                placeholder="São Paulo"
              />
            </label>

            <label className="space-y-1.5 text-sm text-gray-700">
              Estado
              <select
                value={form.state}
                onChange={(e) => handleChange('state', e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#047482] focus:ring-1 focus:ring-[#047482]/20"
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
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#047482] focus:ring-1 focus:ring-[#047482]/20"
              />
            </label>
          </div>
        </div>

        {/* Botão Salvar */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-[#047482] text-white px-8 py-3 rounded-2xl font-semibold hover:bg-[#035e6b] transition disabled:opacity-50"
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
