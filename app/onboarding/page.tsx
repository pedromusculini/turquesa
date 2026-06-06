'use client';

import { useEffect, useMemo, useState, Suspense, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCustomSession } from '@/lib/useSession';
import {
  Building2,
  CheckCircle,
  Search,
  ShieldCheck,
  User,
} from 'lucide-react';
import { BRAND, DEFAULT_PLAN_ID } from '@/lib/visual/brand';
import ChromeExtensionNotice from '@/components/ChromeExtensionNotice';

const { colors: C, productName, tagline } = BRAND;

const initialFormState = {
  fullName: '',
  crm: '',
  specialty: '',
  cnpj: '',
  whatsapp: '',
  clinicName: '',
  cep: '',
  street: '',
  address_number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  country: 'Brasil',
};

/** Aplica máscara de CNPJ: 00.000.000/0000-00 */
function aplicarMascaraCNPJ(valor: string): string {
  const apenasNumeros = valor.replace(/\D/g, '').slice(0, 14);
  let mascara = apenasNumeros;
  if (apenasNumeros.length > 2) mascara = apenasNumeros.slice(0, 2) + '.' + apenasNumeros.slice(2);
  if (apenasNumeros.length > 5) mascara = mascara.slice(0, 6) + '.' + mascara.slice(6);
  if (apenasNumeros.length > 8) mascara = mascara.slice(0, 10) + '/' + mascara.slice(10);
  if (apenasNumeros.length > 12) mascara = mascara.slice(0, 15) + '-' + mascara.slice(15);
  return mascara;
}

/** Aplica máscara de WhatsApp: (99) 99999-9999 */
function aplicarMascaraWhatsapp(valor: string): string {
  const apenasNumeros = valor.replace(/\D/g, '').slice(0, 11);
  let mascara = apenasNumeros;
  if (apenasNumeros.length > 0) mascara = '(' + apenasNumeros;
  if (apenasNumeros.length > 2) mascara = '(' + apenasNumeros.slice(0, 2) + ') ' + apenasNumeros.slice(2);
  if (apenasNumeros.length > 7) mascara = '(' + apenasNumeros.slice(0, 2) + ') ' + apenasNumeros.slice(2, 7) + '-' + apenasNumeros.slice(7);
  return mascara;
}

/** Valida se CNPJ tem 14 dígitos (ignorando máscara) */
function validarCNPJ(cnpj: string): boolean {
  const numeros = cnpj.replace(/\D/g, '');
  return numeros.length === 14;
}

function OnboardingContent() {
  const { data: session, status } = useCustomSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<'form'>('form');
  const [userType, setUserType] = useState<'medico' | 'clinica' | ''>('');
  const [selectedPlan, setSelectedPlan] = useState<string>(DEFAULT_PLAN_ID);
  const [form, setForm] = useState(initialFormState);
  const [trialStarted, setTrialStarted] = useState(false); // New state for trial status
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [searchingCep, setSearchingCep] = useState(false);
  const skipCompletedRedirect = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Client-side supabase is no longer needed for writes, removing to avoid RLS issues

  // Detect choice from URL (redundancy removal)
  useEffect(() => {
    const roleParam = searchParams.get('role');
    const planParam = searchParams.get('plan');
    const trialStartedParam = searchParams.get('trialStarted');
    
    if (planParam === DEFAULT_PLAN_ID || planParam === 'ilimitado') {
      setSelectedPlan(DEFAULT_PLAN_ID);
    } else if (planParam) {
      setSelectedPlan(planParam);
    }
    if (roleParam === 'medico' || roleParam === 'clinica') {
      setUserType(roleParam);
    }
    if (trialStartedParam === 'true') setTrialStarted(true);
    setStep('form');
  }, [searchParams]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/auth/google-access/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.trialConsumed) {
          setTrialStarted(false);
          setInfoMessage(
            'Esta conta Google já utilizou o teste grátis de 30 dias. Você pode continuar escolhendo um plano pago.',
          );
        } else {
          setTrialStarted(true);
        }
      })
      .catch(() => {});
  }, [status]);

  useEffect(() => {
    if (status === 'loading') return;

    const verifyPath =
      '/auth/verificar-email?callbackUrl=' +
      encodeURIComponent('/onboarding' + (typeof window !== 'undefined' ? window.location.search : ''));

    if (status === 'unauthenticated') {
      fetch('/api/auth/google-access/status', { credentials: 'include' })
        .then((r) => {
          if (r.status === 401) router.replace('/login');
        })
        .catch(() => router.replace('/login'));
      return;
    }

    fetch('/api/auth/google-access/status', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.json())
      .then((access) => {
        if (!access.accessVerified) {
          router.replace(verifyPath);
        }
      })
      .catch(() => {});

    if (skipCompletedRedirect.current || isSaving) return;

    fetch('/api/onboarding/status', { cache: 'no-store', credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.onboardingCompleted && !skipCompletedRedirect.current) {
          window.location.assign('/dashboard');
        }
      })
      .catch(() => {});
  }, [status, router, isSaving]);

  const stepLabel = 'Configure seu perfil';

  const handleTypeSelect = (type: 'medico' | 'clinica') => {
    setUserType(type);
    setSelectedPlan(DEFAULT_PLAN_ID);
    setError('');
    setInfoMessage('');
  };

  const handleChange = (field: keyof typeof initialFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleCNPJChange = (value: string) => {
    const comMascara = aplicarMascaraCNPJ(value);
    handleChange('cnpj', comMascara);
    // Feedback visual de validação
    if (comMascara.replace(/\D/g, '').length > 0 && !validarCNPJ(comMascara)) {
      setInfoMessage('CNPJ deve ter 14 dígitos');
    } else {
      setInfoMessage('');
    }
  };

  const handleWhatsappChange = (value: string) => {
    const comMascara = aplicarMascaraWhatsapp(value);
    handleChange('whatsapp', comMascara);
  };

  const addressOk = useMemo(
    () =>
      form.cep.replace(/\D/g, '').length === 8 &&
      form.street.trim() &&
      form.address_number.trim() &&
      form.neighborhood.trim() &&
      form.city.trim() &&
      form.state.trim(),
    [form],
  );

  const canSubmitForm = useMemo(() => {
    if (form.whatsapp.replace(/\D/g, '').length < 10 || !addressOk) return false;
    if (userType === 'medico') {
      return !!(form.fullName.trim() && form.specialty.trim());
    }
    if (userType === 'clinica') {
      const cnpjOk =
        !form.cnpj.replace(/\D/g, '').length || validarCNPJ(form.cnpj);
      return !!(form.clinicName.trim() && cnpjOk);
    }
    return false;
  }, [form, userType, addressOk, selectedPlan]);

  const handleSearchCep = useCallback(async () => {
    const cepLimpo = form.cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      setInfoMessage('CEP deve ter 8 dígitos');
      return;
    }
    setSearchingCep(true);
    setInfoMessage('');
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (data.erro) {
        setInfoMessage('CEP não encontrado');
        return;
      }
      setForm((prev) => ({
        ...prev,
        street: data.logradouro || prev.street,
        complement: data.complemento || prev.complement,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
      setInfoMessage('Endereço preenchido pelo CEP.');
    } catch {
      setInfoMessage('Erro ao buscar CEP. Preencha manualmente.');
    } finally {
      setSearchingCep(false);
    }
  }, [form.cep]);

  async function waitOnboardingComplete(): Promise<boolean> {
    for (let i = 0; i < 10; i++) {
      const res = await fetch('/api/onboarding/status', {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.onboardingCompleted) return true;
      await new Promise((r) => setTimeout(r, 350));
    }
    return false;
  }

  const handleSubmitForm = async () => { // This function now handles saving the form data
    if (!canSubmitForm) {
      setError('Preencha todos os campos obrigatórios antes de continuar.');
      return;
    }

    if (!privacyConsent) {
      setError('Aceite a Política de Privacidade e os Termos de Uso.');
      return;
    }

    if (!session?.user?.email) {
      setError('E-mail do usuário não está disponível. Faça login novamente.');
      return;
    }

    setIsSaving(true);
    skipCompletedRedirect.current = true;
    setError('');
    setInfoMessage('');

    try {
      console.log('[Onboarding] Enviando dados para /api/onboarding/save...');
      const res = await fetch('/api/onboarding/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userType,
          selectedPlan,
          form,
          trialStarted,
          userEmail: session.user.email,
          privacyConsent: true,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        let msg = 'Erro ao salvar perfil';
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.trialBlocked) {
            router.replace('/planos?trial=used');
            return;
          }
          if (errorData.error?.includes('schema cache')) {
            msg = 'O banco de dados ainda está sincronizando. Aguarde 5 segundos e tente novamente.';
          } else {
            msg = errorData.error || msg;
          }
        } catch {
          msg = `Erro inesperado do servidor (${res.status})`;
        }
        throw new Error(msg);
      }
      const saved = await res.json();
      if (!saved.success) {
        throw new Error('Resposta inválida ao salvar perfil');
      }
      setInfoMessage('Perfil configurado! Aguarde...');
      const ready = await waitOnboardingComplete();
      if (!ready) {
        throw new Error(
          'Cadastro salvo, mas a confirmação demorou. Recarregue a página ou acesse o painel em alguns segundos.',
        );
      }
      window.location.assign('/dashboard');
    } catch (err: unknown) {
      skipCompletedRedirect.current = false;
      console.error('[onboarding-form] Erro ao salvar:', err);
      let message = 'Erro ao salvar os dados. Tente novamente.';
      if (err instanceof Error) {
        message = err.message.includes('schema cache') 
          ? 'O banco de dados ainda está sincronizando. Por favor, aguarde alguns segundos e tente novamente.'
          : err.message;
      }
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 py-10"
        style={{ backgroundColor: C.bgOnboarding }}
      >
        <div className="max-w-xl rounded-4xl border border-red-200 bg-white p-8 text-center shadow-xl">
          <h1 className="text-2xl font-semibold text-slate-900">Configuração do Supabase inválida</h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Verifique as variáveis de ambiente públicas do Supabase em <code className="rounded bg-slate-100 px-1 py-0.5">.env.local</code>.
            Elas devem incluir <span className="font-semibold">NEXT_PUBLIC_SUPABASE_URL</span> e
            <span className="font-semibold">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>,
            e o URL precisa ser um endereço válido iniciando com <span className="font-semibold">https://</span>.
          </p>
        </div>
      </div>
    );
  }

  // Prevent hydration mismatch: render static placeholder until first client render
  if (!mounted || status === 'loading') {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ backgroundColor: C.bgOnboarding }}
      >
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
            style={{ borderColor: C.primaryHover }}
          ></div>
          <p className="text-slate-600">Carregando seu onboarding...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ backgroundColor: C.bgOnboarding }}
      >
        <div className="text-center">
          <p className="text-slate-600 mb-4">Redirecionando para login...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8" style={{ backgroundColor: C.bgOnboarding }}>
      <div
        className="mx-auto max-w-3xl rounded-4xl border bg-white/95 p-8 shadow-xl"
        style={{ borderColor: `${C.primaryHover}33` }}
      >
        <div
          className="mb-8 flex flex-col gap-6 rounded-3xl p-6 sm:flex-row sm:items-center sm:justify-between"
          style={{ backgroundColor: C.primaryBg }}
        >
          <div>
            <p className="text-sm uppercase tracking-[0.24em]" style={{ color: C.primaryHover }}>
              Onboarding
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              Complete seu acesso ao {productName}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {tagline} ·{' '}
              <span className="font-medium text-slate-900">{session?.user?.email}</span>
            </p>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-sm">
            <ShieldCheck className="h-8 w-8" style={{ color: C.primaryHover }} />
          </div>
        </div>

        <section className="space-y-6">
          <div className="rounded-3xl border p-6" style={{ borderColor: `${C.primaryHover}22`, backgroundColor: C.primaryBg }}>
            <div className="flex items-center gap-3 text-slate-700">
              <CheckCircle className="h-5 w-5" style={{ color: C.primaryHover }} />
              <p className="text-sm">Seu e-mail foi verificado com sucesso. Prossiga para configurar seu perfil.</p>
            </div>
          </div>

          <ChromeExtensionNotice />

          <div className="rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: `${C.primaryHover}22` }}>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">{stepLabel}</h2>
              <p className="text-sm text-slate-500">
                Plano {BRAND.copy.planDisplayName} · {BRAND.copy.planPriceLabel} após o trial de{' '}
                {BRAND.copy.trialDays} dias.
              </p>
            </div>

            {step === 'form' && (
              <div className="space-y-4">
                {!userType && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-800">Como você usa o salão?</p>
                    <p className="text-xs text-slate-500">
                      Plano único com profissionais ilimitados — escolha só o perfil do negócio.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleTypeSelect('medico')}
                      className="btn-action flex w-full items-center gap-4 rounded-3xl border px-5 py-4 text-left transition touch-manipulation"
                      style={{ borderColor: `${C.primaryHover}44`, backgroundColor: C.primaryBg }}
                    >
                      <User className="h-6 w-6" style={{ color: C.primaryHover }} />
                      <div>
                        <p className="font-semibold text-slate-900">Atendo sozinha(o)</p>
                        <p className="text-sm text-slate-500">
                          Estúdio solo — cadastre profissionais extras quando quiser.
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeSelect('clinica')}
                      className="btn-action flex w-full items-center gap-4 rounded-3xl border px-5 py-4 text-left transition touch-manipulation"
                      style={{ borderColor: `${C.primaryHover}44`, backgroundColor: C.primaryBg }}
                    >
                      <Building2 className="h-6 w-6" style={{ color: C.primaryHover }} />
                      <div>
                        <p className="font-semibold text-slate-900">Salão com equipe</p>
                        <p className="text-sm text-slate-500">
                          Vários profissionais — equipe ilimitada no plano.
                        </p>
                      </div>
                    </button>
                  </div>
                )}

                {userType === 'clinica' ? (
                  <div className="grid gap-4">
                    <label className="space-y-2 text-sm text-slate-700">
                      Nome do salão / estúdio
                      <input value={form.clinicName} onChange={(event) => handleChange('clinicName', event.target.value)} className="w-full rounded-3xl border px-4 py-3 text-slate-900 outline-none" style={{ borderColor: `${C.primaryHover}44`, backgroundColor: C.primaryBg }} placeholder="Estúdio Beleza Turquesa" />
                    </label>
                    <label className="space-y-2 text-sm text-slate-700">
                      CNPJ (opcional)
                      <input value={form.cnpj} onChange={(event) => handleCNPJChange(event.target.value)} className="w-full rounded-3xl border border-[#3795a1]/40 bg-[#eef4f5] px-4 py-3 text-slate-900 outline-none focus:border-[#047482]" placeholder="00.000.000/0000-00" />
                    </label>
                    <p
                      className="text-sm text-slate-600 rounded-2xl px-4 py-3 border"
                      style={{ backgroundColor: C.primaryBg, borderColor: `${C.primaryHover}33` }}
                    >
                      Após concluir, cadastre sua equipe em Catálogo → Profissionais — ilimitadas no
                      plano {BRAND.copy.planDisplayName}.
                    </p>
                    <label className="space-y-2 text-sm text-slate-700">
                      WhatsApp
                      <input value={form.whatsapp} onChange={(event) => handleWhatsappChange(event.target.value)} className="w-full rounded-3xl border border-[#3795a1]/40 bg-[#eef4f5] px-4 py-3 text-slate-900 outline-none focus:border-[#047482]" placeholder="(99) 99999-9999" />
                    </label>
                  </div>
                ) : userType === 'medico' ? (
                  <div className="grid gap-4">
                    <label className="space-y-2 text-sm text-slate-700">
                      Nome completo
                      <input value={form.fullName} onChange={(event) => handleChange('fullName', event.target.value)} className="w-full rounded-3xl border border-[#3795a1]/40 bg-[#eef4f5] px-4 py-3 text-slate-900 outline-none focus:border-[#047482]" placeholder="João Silva" />
                    </label>
                    <label className="space-y-2 text-sm text-slate-700">
                      Serviços principais
                      <input value={form.specialty} onChange={(event) => handleChange('specialty', event.target.value)} className="w-full rounded-3xl border px-4 py-3 text-slate-900 outline-none" style={{ borderColor: `${C.primaryHover}44`, backgroundColor: C.primaryBg }} placeholder="Corte, coloração, unhas, maquiagem…" />
                    </label>
                    <p
                      className="text-sm text-slate-600 rounded-2xl px-4 py-3 border"
                      style={{ backgroundColor: C.primaryBg, borderColor: `${C.primaryHover}33` }}
                    >
                      Profissionais ilimitados no plano {BRAND.copy.planDisplayName}. Cadastre a
                      equipe em Catálogo → Profissionais quando quiser.
                    </p>
                    <label className="space-y-2 text-sm text-slate-700">
                      WhatsApp
                      <input value={form.whatsapp} onChange={(event) => handleWhatsappChange(event.target.value)} className="w-full rounded-3xl border border-[#3795a1]/40 bg-[#eef4f5] px-4 py-3 text-slate-900 outline-none focus:border-[#047482]" placeholder="(99) 99999-9999" />
                    </label>
                  </div>
                ) : (
                  <div className="p-4 text-sm text-slate-500">Selecione o tipo de conta acima para preencher os dados.</div>
                )}

                {(userType === 'medico' || userType === 'clinica') && (
                  <div className="grid gap-4 pt-2 border-t border-[#3795a1]/30">
                    <p className="text-sm font-semibold text-slate-800">
                      Local de atendimento *
                    </p>
                    <label className="space-y-2 text-sm text-slate-700">
                      CEP *
                      <div className="flex gap-2">
                        <input
                          value={form.cep}
                          onChange={(e) =>
                            handleChange('cep', e.target.value.replace(/\D/g, '').slice(0, 8))
                          }
                          className="w-full rounded-3xl border border-[#3795a1]/40 bg-[#eef4f5] px-4 py-3 text-slate-900 outline-none focus:border-[#047482]"
                          placeholder="00000000"
                        />
                        <button
                          type="button"
                          onClick={handleSearchCep}
                          disabled={searchingCep || form.cep.replace(/\D/g, '').length !== 8}
                          className="shrink-0 px-4 rounded-3xl border border-[#3795a1]/40 bg-white hover:bg-[#eef4f5] disabled:opacity-50"
                          title="Buscar CEP"
                        >
                          <Search className="w-5 h-5 text-[#047482]" />
                        </button>
                      </div>
                    </label>
                    <label className="space-y-2 text-sm text-slate-700">
                      Logradouro *
                      <input
                        required
                        value={form.street}
                        onChange={(e) => handleChange('street', e.target.value)}
                        className="w-full rounded-3xl border border-[#3795a1]/40 bg-[#eef4f5] px-4 py-3 text-slate-900 outline-none focus:border-[#047482]"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-2 text-sm text-slate-700">
                        Número *
                        <input
                          required
                          value={form.address_number}
                          onChange={(e) => handleChange('address_number', e.target.value)}
                          className="w-full rounded-3xl border border-[#3795a1]/40 bg-[#eef4f5] px-4 py-3 text-slate-900 outline-none focus:border-[#047482]"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-700">
                        Complemento
                        <input
                          value={form.complement}
                          onChange={(e) => handleChange('complement', e.target.value)}
                          className="w-full rounded-3xl border border-[#3795a1]/40 bg-[#eef4f5] px-4 py-3 text-slate-900 outline-none focus:border-[#047482]"
                        />
                      </label>
                    </div>
                    <label className="space-y-2 text-sm text-slate-700">
                      Bairro *
                      <input
                        required
                        value={form.neighborhood}
                        onChange={(e) => handleChange('neighborhood', e.target.value)}
                        className="w-full rounded-3xl border border-[#3795a1]/40 bg-[#eef4f5] px-4 py-3 text-slate-900 outline-none focus:border-[#047482]"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-2 text-sm text-slate-700">
                        Cidade *
                        <input
                          required
                          value={form.city}
                          onChange={(e) => handleChange('city', e.target.value)}
                          className="w-full rounded-3xl border border-[#3795a1]/40 bg-[#eef4f5] px-4 py-3 text-slate-900 outline-none focus:border-[#047482]"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-700">
                        Estado *
                        <select
                          required
                          value={form.state}
                          onChange={(e) => handleChange('state', e.target.value)}
                          className="w-full rounded-3xl border border-[#3795a1]/40 bg-[#eef4f5] px-4 py-3 text-slate-900 outline-none focus:border-[#047482]"
                        >
                          <option value="">UF</option>
                          {[
                            'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
                            'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
                            'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
                          ].map((uf) => (
                            <option key={uf} value={uf}>
                              {uf}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex items-start gap-3 text-sm text-slate-600">
                  <input
                    id="onboarding-legal"
                    type="checkbox"
                    checked={privacyConsent}
                    onChange={(e) => setPrivacyConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-green-600 focus:ring-green-400"
                  />
                  <label htmlFor="onboarding-legal" className="cursor-pointer leading-snug">
                    Aceito a{' '}
                    <a
                      href="/privacidade"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                      style={{ color: C.primaryHover }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Política de Privacidade
                    </a>{' '}
                    e os{' '}
                    <a
                      href="/termos"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                      style={{ color: C.primaryHover }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Termos de Uso
                    </a>
                    .
                  </label>
                </div>

                {(!canSubmitForm || !privacyConsent) && !isSaving && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    {!canSubmitForm
                      ? 'Preencha todos os campos acima. Se o botão não responder, toque em Finalizar — esta mensagem indica o que falta.'
                      : 'Marque o aceite da Política e dos Termos para finalizar.'}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setUserType('');
                      setError('');
                    }}
                    className="btn-action rounded-3xl border px-6 py-3 text-sm text-slate-700"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitForm}
                    aria-disabled={!canSubmitForm || !privacyConsent || isSaving}
                    data-muted={!canSubmitForm || !privacyConsent || isSaving ? 'true' : undefined}
                    className="btn-action rounded-3xl px-6 py-3 text-sm font-semibold text-white hover:opacity-90 flex items-center gap-2"
                    style={{ backgroundColor: C.primaryHover }}
                  >
                    {isSaving ? (
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    ) : null}
                    {isSaving ? 'Salvando...' : 'Finalizar Cadastro'}
                  </button>
                </div>
                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
                {infoMessage && <p className="mt-3 text-sm text-green-700">{infoMessage}</p>}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#eafde7] flex items-center justify-center">Carregando...</div>}>
      <OnboardingContent />
    </Suspense>
  );
}
