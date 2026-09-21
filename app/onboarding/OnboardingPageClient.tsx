'use client';

import { useEffect, useMemo, useState, Suspense, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCustomSession } from '@/lib/useSession';
import {
  Calendar,
  Copy,
  MessageCircle,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { BRAND, DEFAULT_PLAN_ID } from '@/lib/visual/brand';
import { aplicarMascaraWhatsapp } from '@/lib/constants';
import { isValidPhone } from '@/lib/phoneMatch';
import type { EquipeProfissionalInfo } from '@/lib/onboardingGate';
import { trackMetaCompleteRegistration } from '@/lib/metaPixel';
import { trackGa4Event, trackGoogleAdsSignupConversion } from '@/lib/siteAnalytics';
import { DEFAULT_LANDING_CONFIG } from '@/lib/salonLanding';
import {
  SERVICOS_PRIMEIRO_USO,
  SERVICOS_PRIMEIRO_USO_PADRAO,
} from '@/lib/primeiroUsoSalao';

const { colors: C } = BRAND;

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
  const [step, setStep] = useState<'form' | 'sync' | 'pronto'>('form');
  const [servicosSel, setServicosSel] = useState<string[]>([...SERVICOS_PRIMEIRO_USO_PADRAO]);
  const [linkAgendar, setLinkAgendar] = useState<string | null>(null);
  const [msgWhatsapp, setMsgWhatsapp] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [searchingCep, setSearchingCep] = useState(false);
  const skipCompletedRedirect = useRef(false);
  const [showAddress, setShowAddress] = useState(false);

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
          !skipCompletedRedirect.current &&
          !isSaving &&
          statusData?.onboardingCompleted &&
          step !== 'pronto'
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
      ? 'Preparando seu salão'
      : step === 'pronto'
        ? 'Pode mandar o link'
        : 'Dados do salão';

  const handleChange = (field: keyof typeof initialFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const toggleServico = (id: string) => {
    setServicosSel((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
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

  const canSubmitForm = useMemo(() => {
    const cnpjOk = !form.cnpj.replace(/\D/g, '').length || validarCNPJ(form.cnpj);
    const cepDigits = form.cep.replace(/\D/g, '');
    const cepOk = !cepDigits.length || cepDigits.length === 8;
    return !!(form.clinicName.trim() && isValidPhone(form.whatsapp) && cnpjOk && cepOk);
  }, [form]);

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
            specialty: SERVICOS_PRIMEIRO_USO.filter((s) => servicosSel.includes(s.id))
              .map((s) => s.nome)
              .join(', '),
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
      trackMetaCompleteRegistration(saved.metaEventId || undefined);
      trackGa4Event('sign_up', { method: 'google', content_name: 'onboarding_titular' });
      trackGoogleAdsSignupConversion();
      setInfoMessage('');
      try {
        await fetch('/api/presenca/config', {
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
        });
      } catch {
        /* site público pode ser configurado depois no painel */
      }
      await handleSetupTitularProfissional();
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

  const handleSetupTitularProfissional = async () => {
    setIsSaving(true);
    setError('');
    setSyncStatus('Cadastrando você como profissional…');
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

      setSyncStatus('Preparando serviços, horários e o link…');
      try {
        const prepRes = await fetch('/api/onboarding/primeiro-uso', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ servicos: servicosSel }),
        });
        const prep = await prepRes.json().catch(() => ({}));
        if (typeof prep.link_agendar === 'string' && prep.link_agendar) {
          setLinkAgendar(prep.link_agendar);
        }
        if (typeof prep.mensagem_whatsapp === 'string' && prep.mensagem_whatsapp) {
          setMsgWhatsapp(prep.mensagem_whatsapp);
        }
      } catch (prepErr) {
        console.warn('[onboarding] primeiro-uso', prepErr);
      }

      setStep('pronto');
    } catch (err: unknown) {
      console.error('[onboarding] setup titular profissional', err);
      setStep('pronto');
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
              Configure seu salão
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Só o essencial agora. Catálogo, horários e site você ajusta no painel.{' '}
              <span className="font-medium text-slate-900">{session?.user?.email}</span>
            </p>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-sm">
            <ShieldCheck className="h-8 w-8" style={{ color: C.primaryHover }} />
          </div>
        </div>

        <section className="space-y-6">
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
                  <div className="space-y-2 text-sm text-slate-700">
                    <p>O que você atende?</p>
                    <p className="text-xs text-slate-500">
                      Toque para marcar. Já deixamos preço e tempo — você ajusta depois.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {SERVICOS_PRIMEIRO_USO.map((item) => {
                        const on = servicosSel.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleServico(item.id)}
                            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                              on ? 'text-white' : 'border border-slate-200 bg-white text-slate-700'
                            }`}
                            style={on ? { backgroundColor: C.primaryHover } : undefined}
                          >
                            {item.nome}
                          </button>
                        );
                      })}
                    </div>
                  </div>
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
                    Em seguida o salão já fica com horários (ter–sáb, 9h–18h) e um link para a
                    cliente marcar sozinha. Você muda tudo depois no painel.
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

                <div className="pt-2 border-t border-[#3795a1]/30">
                    <button
                      type="button"
                      onClick={() => setShowAddress((v) => !v)}
                      className="text-sm font-semibold text-slate-800 hover:underline"
                    >
                      {showAddress ? 'Ocultar endereço' : 'Adicionar endereço (opcional)'}
                    </button>
                    <p className="mt-1 text-xs text-slate-500">
                      Pode completar depois. Aparece no site público e nas mensagens.
                    </p>
                    {showAddress && (
                    <div className="grid gap-4 mt-3">
                    <label className="space-y-2 text-sm text-slate-700">
                      CEP
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
                      Logradouro
                      <input
                        value={form.street}
                        onChange={(e) => handleChange('street', e.target.value)}
                        className="w-full rounded-3xl border border-[#3795a1]/40 bg-[#eef4f5] px-4 py-3 text-slate-900 outline-none focus:border-[#047482]"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-2 text-sm text-slate-700">
                        Número
                        <input
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
                      Bairro
                      <input
                        value={form.neighborhood}
                        onChange={(e) => handleChange('neighborhood', e.target.value)}
                        className="w-full rounded-3xl border border-[#3795a1]/40 bg-[#eef4f5] px-4 py-3 text-slate-900 outline-none focus:border-[#047482]"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-2 text-sm text-slate-700">
                        Cidade
                        <input
                          value={form.city}
                          onChange={(e) => handleChange('city', e.target.value)}
                          className="w-full rounded-3xl border border-[#3795a1]/40 bg-[#eef4f5] px-4 py-3 text-slate-900 outline-none focus:border-[#047482]"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-700">
                        Estado
                        <select
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
                      ? 'Informe o nome do salão e um WhatsApp válido. Toque em Começar a usar para continuar.'
                      : 'Marque o aceite da Política e dos Termos para continuar.'}
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
                    {isSaving ? 'Salvando...' : 'Começar a usar'}
                  </button>
                </div>
                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
                {infoMessage && <p className="mt-3 text-sm text-green-700">{infoMessage}</p>}
              </div>
            )}

            {step === 'sync' && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div
                  className="h-10 w-10 animate-spin rounded-full border-b-2"
                  style={{ borderColor: C.primaryHover }}
                />
                <p className="text-sm font-medium text-slate-800">
                  {syncStatus || 'Preparando…'}
                </p>
                <p className="max-w-sm text-xs text-slate-500">
                  Estamos montando o catálogo, os horários e o link de autoagendamento.
                </p>
              </div>
            )}

            {step === 'pronto' && (
              <div className="space-y-5">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Seu salão já recebe horário</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Manda esse link no WhatsApp. A cliente escolhe o serviço e o horário — sem
                    “tem horário?”.
                  </p>
                </div>
                {linkAgendar ? (
                  <>
                    <p className="break-all rounded-2xl bg-[#eef4f5] px-4 py-3 font-mono text-sm text-slate-800">
                      {linkAgendar}
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(linkAgendar);
                          setCopied(true);
                          window.setTimeout(() => setCopied(false), 2000);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-3xl border border-[#047482]/30 px-4 py-3 text-sm font-semibold text-[#047482]"
                      >
                        <Copy className="h-4 w-4" />
                        {copied ? 'Copiado!' : 'Copiar link'}
                      </button>
                      {msgWhatsapp ? (
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(msgWhatsapp)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-3xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Abrir WhatsApp
                        </a>
                      ) : null}
                      <a
                        href={linkAgendar}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-3xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
                      >
                        Testar como cliente
                      </a>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-600">
                    O painel está pronto. O link de autoagendamento pode ser gerado em Links.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => window.location.assign('/dashboard')}
                  className="w-full rounded-3xl px-6 py-3 text-sm font-semibold text-white"
                  style={{ backgroundColor: C.primaryHover }}
                >
                  Ir para o painel
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
