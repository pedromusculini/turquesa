'use client';

import { useEffect, useMemo, useState, Suspense, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCustomSession } from '@/lib/useSession';
import {
  Calendar,
  CheckCircle,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { BRAND, DEFAULT_PLAN_ID } from '@/lib/visual/brand';
import ChromeExtensionNotice from '@/components/ChromeExtensionNotice';
import { aplicarMascaraWhatsapp } from '@/lib/constants';
import { isValidPhone } from '@/lib/phoneMatch';
import type { EquipeProfissionalInfo } from '@/lib/onboardingGate';
import { trackMetaCompleteRegistration } from '@/lib/metaPixel';

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

/** Valida se CNPJ tem 14 dígitos (ignorando máscara) */
function validarCNPJ(cnpj: string): boolean {
  const numeros = cnpj.replace(/\D/g, '');
  return numeros.length === 14;
}

type OnboardingPageClientProps = {
  initialEquipeProfissional: EquipeProfissionalInfo | null;
  equipeCheckedOnServer: boolean;
};

function OnboardingContent({
  initialEquipeProfissional,
  equipeCheckedOnServer,
}: OnboardingPageClientProps) {
  const { data: session, status } = useCustomSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<'form'>('form');
  const userType = 'clinica' as const;
  const selectedPlan = DEFAULT_PLAN_ID;
  const [equipeProfissional, setEquipeProfissional] = useState<EquipeProfissionalInfo | null>(
    initialEquipeProfissional,
  );
  const [membershipResolved, setMembershipResolved] = useState(equipeCheckedOnServer);
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

  useEffect(() => {
    const trialStartedParam = searchParams.get('trialStarted');
    if (trialStartedParam === 'true') setTrialStarted(true);
    setStep('form');
  }, [searchParams]);

  useEffect(() => {
    if (status !== 'authenticated') {
      if (status === 'unauthenticated') setMembershipResolved(true);
      return;
    }

    const verifyPath =
      '/auth/verificar-email?callbackUrl=' +
      encodeURIComponent('/onboarding' + (typeof window !== 'undefined' ? window.location.search : ''));

    let cancelled = false;

    void (async () => {
      try {
        const [accessRes, statusRes] = await Promise.all([
          fetch('/api/auth/google-access/status', { cache: 'no-store', credentials: 'include' }),
          fetch('/api/onboarding/status', { cache: 'no-store', credentials: 'include' }),
        ]);

        if (cancelled) return;

        const access = accessRes.ok ? await accessRes.json() : null;
        const statusData = statusRes.ok ? await statusRes.json() : null;

        const equipe = statusData?.equipeProfissional ?? access?.equipeProfissional ?? null;
        if (equipe) {
          setEquipeProfissional(equipe);
        }

        if (access?.trialConsumed) {
          setTrialStarted(false);
          setInfoMessage(
            'Esta conta Google já utilizou o teste grátis de 30 dias. Você pode continuar com a assinatura paga.',
          );
        } else if (access && !equipe) {
          setTrialStarted(true);
        }

        if (!access?.accessVerified && !equipe) {
          router.replace(verifyPath);
          return;
        }

        if (
          !skipCompletedRedirect.current &&
          !isSaving &&
          statusData?.onboardingCompleted &&
          !equipe
        ) {
          window.location.assign('/dashboard');
          return;
        }
      } catch {
        // mantém loading até nova tentativa manual (reload)
      } finally {
        if (!cancelled) setMembershipResolved(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, router, isSaving]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      fetch('/api/auth/google-access/status', { credentials: 'include' })
        .then((r) => {
          if (r.status === 401) router.replace('/login');
        })
        .catch(() => router.replace('/login'));
    }
  }, [status, router]);

  const stepLabel = 'Configure seu perfil';

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
    if (!isValidPhone(form.whatsapp) || !addressOk) return false;
    const cnpjOk = !form.cnpj.replace(/\D/g, '').length || validarCNPJ(form.cnpj);
    return !!(form.clinicName.trim() && form.specialty.trim() && cnpjOk);
  }, [form, addressOk]);

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
      trackMetaCompleteRegistration();
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

  if (!membershipResolved) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ backgroundColor: C.bgOnboarding }}
      >
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
            style={{ borderColor: C.primaryHover }}
          />
          <p className="text-slate-600">Verificando seu acesso à equipe...</p>
        </div>
      </div>
    );
  }

  if (equipeProfissional) {
    const callbackUrl = searchParams.get('callbackUrl');
    return (
      <main className="min-h-screen px-4 py-8" style={{ backgroundColor: C.bgOnboarding }}>
        <div
          className="mx-auto max-w-lg rounded-4xl border bg-white/95 p-8 shadow-xl"
          style={{ borderColor: `${C.primaryHover}33` }}
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-[#047482]/10 p-3">
              <Calendar className="h-6 w-6 text-[#047482]" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Profissional da equipe
              </p>
              <h1 className="text-xl font-semibold text-slate-900">
                {equipeProfissional.agendaConectada
                  ? 'Agenda já conectada'
                  : 'Você faz parte da equipe'}
              </h1>
            </div>
          </div>
          {equipeProfissional.agendaConectada ? (
            <p className="text-sm text-slate-700 leading-relaxed">
              Olá, <strong>{equipeProfissional.nomeProfissional}</strong>! Sua agenda Google já está
              vinculada ao salão <strong>{equipeProfissional.nomeSalao}</strong>. Não é necessário
              criar conta de titular — use os links enviados no Google Calendar para ver fichas de
              clientes e anamnese.
            </p>
          ) : (
            <p className="text-sm text-slate-700 leading-relaxed">
              Olá, <strong>{equipeProfissional.nomeProfissional}</strong>! Você está cadastrada na
              equipe do salão <strong>{equipeProfissional.nomeSalao}</strong>. Não é necessário criar
              conta de titular — peça ao titular para conectar sua Agenda Google em Configurações →
              Equipe.
            </p>
          )}
          {callbackUrl && callbackUrl.startsWith('/f/') && (
            <a
              href={callbackUrl}
              className="mt-6 flex w-full items-center justify-center rounded-3xl px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: C.primaryHover }}
            >
              Abrir ficha do cliente
            </a>
          )}
          <p className="mt-6 text-center text-xs text-slate-400">
            Para gerenciar o salão, o titular da conta deve fazer o cadastro com o e-mail do negócio.
          </p>
        </div>
      </main>
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
                <div className="grid gap-4">
                  <label className="space-y-2 text-sm text-slate-700">
                    Nome do salão / estúdio *
                    <input
                      value={form.clinicName}
                      onChange={(event) => handleChange('clinicName', event.target.value)}
                      className="w-full rounded-3xl border px-4 py-3 text-slate-900 outline-none"
                      style={{ borderColor: `${C.primaryHover}44`, backgroundColor: C.primaryBg }}
                      placeholder="Estúdio Beleza Turquesa"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    Serviços principais *
                    <input
                      value={form.specialty}
                      onChange={(event) => handleChange('specialty', event.target.value)}
                      className="w-full rounded-3xl border px-4 py-3 text-slate-900 outline-none"
                      style={{ borderColor: `${C.primaryHover}44`, backgroundColor: C.primaryBg }}
                      placeholder="Corte, coloração, unhas, maquiagem…"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    CNPJ (opcional)
                    <input
                      value={form.cnpj}
                      onChange={(event) => handleCNPJChange(event.target.value)}
                      className="w-full rounded-3xl border border-[#3795a1]/40 bg-[#eef4f5] px-4 py-3 text-slate-900 outline-none focus:border-[#047482]"
                      placeholder="00.000.000/0000-00"
                    />
                  </label>
                  <p
                    className="text-sm text-slate-600 rounded-2xl px-4 py-3 border"
                    style={{ backgroundColor: C.primaryBg, borderColor: `${C.primaryHover}33` }}
                  >
                    Plano {BRAND.copy.planDisplayName} com equipe ilimitada. Cadastre profissionais
                    em Configurações → Equipe após concluir.
                  </p>
                  <label className="space-y-2 text-sm text-slate-700">
                    WhatsApp *
                    <input
                      value={form.whatsapp}
                      onChange={(event) => handleWhatsappChange(event.target.value)}
                      className="w-full rounded-3xl border border-[#3795a1]/40 bg-[#eef4f5] px-4 py-3 text-slate-900 outline-none focus:border-[#047482]"
                      placeholder="(99) 99999-9999"
                    />
                  </label>
                </div>

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

                <div className="mt-4 flex items-center justify-end gap-4">
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

export default function OnboardingPageClient(props: OnboardingPageClientProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#eafde7] flex items-center justify-center">Carregando...</div>}>
      <OnboardingContent {...props} />
    </Suspense>
  );
}
