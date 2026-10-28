'use client';

import { useEffect, useMemo, useState, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCustomSession } from '@/lib/useSession';
import { Calendar } from 'lucide-react';
import { BRAND, DEFAULT_PLAN_ID } from '@/lib/visual/brand';
import { aplicarMascaraWhatsapp } from '@/lib/constants';
import { isValidPhone } from '@/lib/phoneMatch';
import type { EquipeProfissionalInfo } from '@/lib/onboardingGate';
import { trackMetaCompleteRegistration } from '@/lib/metaPixel';
import { trackGa4Event, trackGoogleAdsSignupConversion } from '@/lib/siteAnalytics';
import { DEFAULT_LANDING_CONFIG } from '@/lib/salonLanding';
import { googleAuthorizeUrl } from '@/lib/useGoogleConnectionHealth';
import { fetchGoogleConnections } from '@/lib/googleConnectionsClientCache';
import { markPrimeiroUsoPendente } from '@/lib/primeiroUsoClient';
import { registrarEtapaOnboarding } from '@/lib/onboardingEtapaClient';

const { colors: C } = BRAND;
const FIRST_USE_SETUP_PENDING_KEY = 'turquesa:onboarding-preparo-pendente';

function setFirstUseSetupPending(pending: boolean): void {
  try {
    if (pending) sessionStorage.setItem(FIRST_USE_SETUP_PENDING_KEY, '1');
    else sessionStorage.removeItem(FIRST_USE_SETUP_PENDING_KEY);
  } catch {
    /* o fluxo segue mesmo quando o navegador bloqueia o sessionStorage */
  }
}

function hasFirstUseSetupPending(): boolean {
  try {
    return sessionStorage.getItem(FIRST_USE_SETUP_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

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
  const [step, setStep] = useState<'form' | 'sync' | 'erro'>('form');
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
  const [syncStatus, setSyncStatus] = useState('');
  const [setupError, setSetupError] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const skipCompletedRedirect = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const nomeGoogle = session?.user?.name?.trim();
    if (!nomeGoogle) return;
    setForm((prev) => (prev.clinicName.trim() ? prev : { ...prev, clinicName: nomeGoogle }));
  }, [session?.user?.name]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Client-side supabase is no longer needed for writes, removing to avoid RLS issues

  useEffect(() => {
    const trialStartedParam = searchParams.get('trialStarted');
    if (trialStartedParam === 'true') setTrialStarted(true);
  }, [searchParams]);

  useEffect(() => {
    if (status !== 'authenticated') {
      if (status === 'unauthenticated') setMembershipResolved(true);
      return;
    }

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

        if (
          step === 'form' &&
          statusData?.onboardingCompleted &&
          hasFirstUseSetupPending()
        ) {
          skipCompletedRedirect.current = true;
          setSetupError('Seu cadastro foi salvo; falta terminar a preparação da agenda.');
          setStep('erro');
          return;
        }

        if (
          !skipCompletedRedirect.current &&
          !isSaving &&
          statusData?.onboardingCompleted &&
          step === 'form'
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
  }, [status, router, isSaving, step]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      fetch('/api/auth/google-access/status', { credentials: 'include' })
        .then((r) => {
          if (r.status === 401) router.replace('/login');
        })
        .catch(() => router.replace('/login'));
    }
  }, [status, router]);

  const stepLabel =
    step === 'sync'
      ? 'Passo 2 de 2 · Liberar o Google'
      : step === 'erro'
        ? 'Quase pronto'
        : 'Passo 1 de 2 · Seu salão';

  const handleChange = (field: keyof typeof initialFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleWhatsappChange = (value: string) => {
    const comMascara = aplicarMascaraWhatsapp(value);
    handleChange('whatsapp', comMascara);
  };

  const canSubmitForm = useMemo(
    () => !!(form.clinicName.trim() && isValidPhone(form.whatsapp)),
    [form.clinicName, form.whatsapp],
  );

  async function waitOnboardingComplete(): Promise<boolean> {
    for (let i = 0; i < 15; i++) {
      const res = await fetch('/api/onboarding/status', {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.onboardingCompleted) return true;
      await new Promise((r) => setTimeout(r, 200));
    }
    return false;
  }

  const handleSubmitForm = async () => { // This function now handles saving the form data
    if (!canSubmitForm) {
      setError('Informe o nome do salão e um WhatsApp válido para continuar.');
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
          form: {
            ...form,
            specialty: '',
          },
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
      const saved = (await res.json()) as { success?: boolean; metaEventId?: string | null };
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
      if (saved.metaEventId) {
        trackMetaCompleteRegistration(saved.metaEventId);
        trackGa4Event('sign_up', { method: 'google', content_name: 'onboarding_titular' });
        trackGoogleAdsSignupConversion();
      }
      setInfoMessage('');
      registrarEtapaOnboarding('cadastro_salvo');
      // Roda junto com o preparo da agenda; só é esperado antes de sair da página.
      const presencaPronta = fetch('/api/presenca/config', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estilo: DEFAULT_LANDING_CONFIG.estilo,
          paleta: DEFAULT_LANDING_CONFIG.paleta,
          tituloHero: DEFAULT_LANDING_CONFIG.tituloHero,
          textoExperiencia: DEFAULT_LANDING_CONFIG.textoExperiencia,
          blocos: DEFAULT_LANDING_CONFIG.blocos,
          publicada: true,
        }),
      }).catch(() => {
        /* site público pode ser configurado depois no painel */
      });
      setFirstUseSetupPending(true);
      await handleSetupTitularProfissional(presencaPronta);
      return;
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
      if (step === 'form') setIsSaving(false);
    }
  };

  const handleSetupTitularProfissional = async (esperar?: Promise<unknown>) => {
    setIsSaving(true);
    setFirstUseSetupPending(true);
    setSetupError('');
    setError('');
    setSyncStatus('Preparando seus horários e o link de agendamento…');
    setStep('sync');
    try {
      const setupRes = await fetch('/api/onboarding/setup-titular-profissional', {
        method: 'POST',
        credentials: 'include',
      });
      const setupData = await setupRes.json().catch(() => ({}));
      if (!setupRes.ok) {
        throw new Error(
          typeof setupData.error === 'string'
            ? setupData.error
            : 'Não foi possível cadastrar a profissional.',
        );
      }

      const prepRes = await fetch('/api/onboarding/primeiro-uso', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servicos: [] }),
      });
      const prep = await prepRes.json().catch(() => ({}));
      if (
        !prepRes.ok ||
        prep?.ok !== true ||
        typeof prep.link_agendar !== 'string' ||
        !prep.link_agendar
      ) {
        throw new Error(
          typeof prep.error === 'string'
            ? prep.error
            : 'Não conseguimos preparar seu catálogo, seus horários e seu link. Tente novamente.',
        );
      }
      await esperar;
      setFirstUseSetupPending(false);
      registrarEtapaOnboarding('preparo_ok');

      // Sem tela intermediária: se o Google já está liberado vai direto à agenda,
      // senão abre o consentimento do Google (volta para a agenda sozinho).
      markPrimeiroUsoPendente();
      let googlePronto = false;
      try {
        const g = await fetchGoogleConnections({ light: true, force: true });
        googlePronto =
          !g.needsConnect &&
          !g.needsReconnect &&
          g.healthy !== false &&
          g.driveHealthy !== false &&
          g.calendarHealthy !== false;
      } catch {
        googlePronto = false;
      }
      if (googlePronto) {
        registrarEtapaOnboarding('agenda_direta');
        window.location.assign('/agenda?primeiro=1');
      } else {
        registrarEtapaOnboarding('google_redirecionado');
        window.location.assign(googleAuthorizeUrl('/agenda?primeiro=1'));
      }
      return;
    } catch (err: unknown) {
      console.error('[onboarding] setup titular profissional', err);
      const message = err instanceof Error ? err.message : '';
      setSetupError(
        /fetch|network/i.test(message)
          ? 'Não foi possível falar com o servidor. Confira sua conexão e tente novamente.'
          : message || 'Não conseguimos preparar sua agenda. Tente novamente.',
      );
      setStep('erro');
    } finally {
      setIsSaving(false);
      setSyncStatus('');
    }
  };

  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 py-10"
        style={{ backgroundColor: C.bgOnboarding }}
      >
        <div className="max-w-xl rounded-4xl border border-red-200 bg-white p-8 text-center shadow-xl">
          <h1 className="text-2xl font-semibold text-slate-900">Não conseguimos abrir agora</h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Tivemos um problema do nosso lado. Tente de novo em alguns instantes; se continuar,
            fale com a gente pelo WhatsApp do site.
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
        <div className="mb-5">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Abra sua agenda</h1>
          <p className="mt-1 text-sm text-slate-600">
            Dois passos rápidos. Serviços, preços e endereço você ajusta depois.
          </p>
        </div>

        <section className="space-y-6">
          <div className="rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: `${C.primaryHover}22` }}>
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-900">{stepLabel}</h2>
              <p className="text-sm text-slate-500">
                {BRAND.copy.trialDays} dias grátis · depois {BRAND.copy.planPriceLabel}
              </p>
            </div>

            {step === 'form' && (
              <form
                className="space-y-4"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!isSaving) void handleSubmitForm();
                }}
              >
                <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                  Nome do salão ou estúdio
                  <input
                    value={form.clinicName}
                    onChange={(event) => handleChange('clinicName', event.target.value)}
                    className="w-full rounded-2xl border px-4 py-3 text-base text-slate-900 outline-none focus:border-[#047482]"
                    style={{ borderColor: `${C.primaryHover}44`, backgroundColor: C.primaryBg }}
                    placeholder="Estúdio Beleza Turquesa"
                    autoComplete="organization"
                    enterKeyHint="next"
                  />
                </label>
                <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                  Seu WhatsApp
                  <input
                    value={form.whatsapp}
                    onChange={(event) => handleWhatsappChange(event.target.value)}
                    className="w-full rounded-2xl border px-4 py-3 text-base text-slate-900 outline-none focus:border-[#047482]"
                    style={{ borderColor: `${C.primaryHover}44`, backgroundColor: C.primaryBg }}
                    placeholder="(99) 99999-9999"
                    inputMode="tel"
                    autoComplete="tel"
                    enterKeyHint="go"
                    autoFocus={!!form.clinicName.trim()}
                  />
                </label>

                <div className="flex items-start gap-3 text-sm text-slate-600">
                  <input
                    id="onboarding-legal"
                    type="checkbox"
                    checked={privacyConsent}
                    onChange={(e) => setPrivacyConsent(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-green-600 focus:ring-green-400"
                  />
                  <label htmlFor="onboarding-legal" className="cursor-pointer leading-snug">
                    Aceito a{' '}
                    <a
                      href="/privacidade"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline-offset-2 hover:underline"
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
                      className="font-medium underline-offset-2 hover:underline"
                      style={{ color: C.primaryHover }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Termos de Uso
                    </a>
                    .
                  </label>
                </div>

                {error ? (
                  <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                ) : null}
                {infoMessage ? <p className="text-sm text-green-700">{infoMessage}</p> : null}

                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-action flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-base font-semibold text-white hover:opacity-90 disabled:opacity-70"
                  style={{ backgroundColor: C.primaryHover }}
                >
                  {isSaving ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                  ) : null}
                  {isSaving ? 'Salvando…' : 'Continuar'}
                </button>
                <p className="text-center text-xs text-slate-500">
                  Entrando como <span className="font-medium text-slate-700">{session?.user?.email}</span>
                </p>
              </form>
            )}

            {step === 'sync' && (
              <div className="flex flex-col items-center gap-4 py-6 text-center" aria-live="polite">
                <div
                  className="h-10 w-10 animate-spin rounded-full border-b-2"
                  style={{ borderColor: C.primaryHover }}
                />
                <p className="text-sm font-medium text-slate-800">
                  {syncStatus || 'Preparando…'}
                </p>
                <div className="max-w-sm rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900">
                  <p className="font-semibold">Já já o Google vai pedir permissão.</p>
                  <p className="mt-1">
                    Deixe <strong>todas as caixas marcadas</strong> (Agenda, Drive e Contatos).
                    Sem uma delas a agenda não abre.
                  </p>
                </div>
              </div>
            )}

            {step === 'erro' && (
              <div className="space-y-4" aria-live="polite">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Seu cadastro foi salvo; falta preparar a agenda</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Não vamos abrir a agenda como pronta até confirmar seus serviços, horários e link de agendamento.
                  </p>
                  <p className="mt-2 text-sm text-red-700">{setupError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSetupTitularProfissional()}
                  disabled={isSaving}
                  className="flex w-full items-center justify-center rounded-3xl px-6 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: C.primaryHover }}
                >
                  {isSaving ? 'Preparando…' : 'Tentar preparar de novo'}
                </button>
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
