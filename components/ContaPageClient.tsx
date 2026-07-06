'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CreditCard,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  Info,
  ExternalLink,
  Shield,
} from 'lucide-react';
import { PRIVACY_CONTACT } from '@/lib/legal';

type ContaResponse = {
  subscription: {
    status: string;
    canUseApp: boolean;
    plano: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    daysLeftTrial: number | null;
    trialPaymentDay: number;
    first_payment_at: string | null;
    messages: {
      trialPaymentDue: boolean;
      boletoFirstPaymentWarning: boolean;
      boletoRenewalGraceWarning: boolean;
      graceEndsAt: string | null;
    };
  };
  profile: {
    plan_name: string;
    plan_value: number | null;
    user_type: string;
  };
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function statusLabel(status: string): string {
  if (status === 'trial') return 'Período de teste';
  if (status === 'active') return 'Assinatura ativa';
  return 'Assinatura inativa';
}

export default function ContaPageClient() {
  const searchParams = useSearchParams();
  const expiredRedirect = searchParams.get('expired') === '1';
  const [data, setData] = useState<ContaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payLoading, setPayLoading] = useState<'cartao' | 'pix' | null>(null);
  const [payError, setPayError] = useState('');
  const [payProfileUrl, setPayProfileUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/conta')
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          const err = new Error(json.error || 'Erro ao carregar conta') as Error & {
            code?: string;
          };
          err.code = json.code;
          throw err;
        }
        return json;
      })
      .then((json) => setData(json))
      .catch((e) => {
        const err = e as Error & { code?: string };
        if (err.code === 'ONBOARDING_REQUIRED') {
          setError('onboarding');
          return;
        }
        setError(err.message || 'Erro ao carregar');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#047482]" />
      </div>
    );
  }

  if (error === 'onboarding') {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm leading-relaxed">
          Falta concluir o cadastro inicial (nome e dados do salão ou estúdio).
        </p>
        <Link
          href="/onboarding"
          className="mt-6 inline-flex items-center justify-center rounded-2xl bg-[#047482] text-white font-semibold px-6 py-3 hover:bg-[#035e6b]"
        >
          Completar cadastro
        </Link>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center text-red-600">
        <p>{error || 'Não foi possível carregar'}</p>
        <Link href="/login" className="text-[#047482] underline mt-4 inline-block">
          Voltar ao login
        </Link>
      </div>
    );
  }

  const { subscription: sub, profile } = data;
  const isExpired = sub.status === 'expired' || !sub.canUseApp;
  const { messages } = sub;

  async function openPagamentoAsaas(metodo: 'cartao' | 'pix') {
    setPayLoading(metodo);
    setPayError('');
    setPayProfileUrl(null);
    try {
      const res = await fetch(`/api/conta/pagamento?metodo=${metodo}`);
      const json = await res.json();
      if (!json.ok || !json.url) {
        setPayProfileUrl(typeof json.profileUrl === 'string' ? json.profileUrl : null);
        throw new Error(json.message || 'Não foi possível abrir o pagamento');
      }
      window.open(json.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Erro ao abrir pagamento');
    } finally {
      setPayLoading(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href={sub.canUseApp ? '/dashboard' : '/backup'}
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        Voltar
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-[#3795a1]/20">
          <CreditCard className="w-6 h-6 text-[#047482]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Minha conta</h1>
          <p className="text-gray-500 text-sm">Plano e pagamento Turquesa Agenda</p>
        </div>
      </div>

      {expiredRedirect && isExpired && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
          <p className="text-sm text-amber-900">
            O acesso operacional está bloqueado. Seus dados no Google Drive{' '}
            <strong>não foram apagados</strong>. Regularize o pagamento ou exporte um backup abaixo.
          </p>
        </div>
      )}

      {sub.status === 'trial' && messages.trialPaymentDue && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-300 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-800 shrink-0" />
          <div className="text-sm text-amber-950 space-y-1">
            <p className="font-semibold">
              A partir do dia {sub.trialPaymentDay} é obrigatório cadastrar o pagamento no Asaas
            </p>
            <p>
              Você tem <strong>{sub.daysLeftTrial ?? 0} dia(s)</strong> de teste restante(s) (até{' '}
              {formatDate(sub.trial_ends_at)}). No dia {sub.trialPaymentDay} abra o link de cobrança
              do Asaas, informe seus dados e escolha cartão (automático) ou PIX. O único benefício é este
              período gratuito — sem outros descontos.
            </p>
          </div>
        </div>
      )}

      {messages.boletoRenewalGraceWarning && messages.graceEndsAt && (
        <div className="mb-6 p-4 rounded-2xl bg-blue-50 border border-blue-200 flex gap-3">
          <Info className="w-5 h-5 text-blue-800 shrink-0" />
          <p className="text-sm text-blue-900">
            Boleto em tolerância de renovação até <strong>{formatDate(messages.graceEndsAt)}</strong>.
            Se não compensar até lá, o acesso será bloqueado até o Asaas confirmar o pagamento.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Plano</span>
          <span className="font-semibold">{profile.plan_name}</span>
        </div>
        {profile.plan_value != null && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Valor mensal</span>
            <span>R$ {profile.plan_value.toFixed(2).replace('.', ',')}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Status</span>
          <span
            className={`inline-flex items-center gap-1.5 font-medium ${
              isExpired ? 'text-red-700' : 'text-[#047482]'
            }`}
          >
            {isExpired ? (
              <AlertTriangle className="w-4 h-4" />
            ) : sub.status === 'trial' ? (
              <Clock className="w-4 h-4" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {statusLabel(sub.status)}
          </span>
        </div>
        {sub.status === 'trial' && sub.daysLeftTrial != null && (
          <p className="text-sm text-gray-600">
            Teste gratuito: <strong>{sub.daysLeftTrial} dia(s)</strong> restante(s) (até{' '}
            {formatDate(sub.trial_ends_at)}). Após o 30º dia, só volta a usar após confirmação do
            pagamento pelo Asaas.
          </p>
        )}
        {sub.status === 'active' && (
          <p className="text-sm text-gray-600">
            Acesso liberado até <strong>{formatDate(sub.current_period_end)}</strong> (30 dias por
            pagamento confirmado).
          </p>
        )}
      </div>

      <div className="mb-6 p-5 rounded-2xl bg-[#eef4f5] border border-[#3795a1]/60">
        <h2 className="font-semibold text-gray-900 mb-2">Pagamento no Asaas</h2>
        <p className="text-sm text-gray-700 mb-3">
          Você pode pagar ou adiantar a mensalidade <strong>quando quiser</strong>. Cada pagamento
          confirmado pelo Asaas libera <strong>30 dias</strong> de acesso (somam ao período atual se
          ainda estiver ativo).
        </p>
        {payError && (
          <div className="text-sm text-red-800 mb-3 bg-red-50 p-2 rounded-lg border border-red-100">
            <p>{payError}</p>
            {payProfileUrl && (
              <Link href={payProfileUrl} className="mt-2 inline-block font-medium text-[#047482] underline">
                Ir para Meu Perfil
              </Link>
            )}
          </div>
        )}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => openPagamentoAsaas('cartao')}
            disabled={payLoading !== null}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#047482] text-white font-semibold hover:bg-[#035e6b] transition disabled:opacity-60"
          >
            {payLoading === 'cartao' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CreditCard className="w-5 h-5" />
            )}
            Cartão — renovação automática
          </button>
          <button
            type="button"
            onClick={() => openPagamentoAsaas('pix')}
            disabled={payLoading !== null}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-[#047482]/30 bg-white text-[#047482] font-semibold hover:bg-[#D9F0F2]/40 transition disabled:opacity-60"
          >
            {payLoading === 'pix' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ExternalLink className="w-5 h-5" />
            )}
            PIX — pagar este mês
          </button>
        </div>
      </div>

      <div className="mb-6 p-4 rounded-2xl bg-gray-50 border border-gray-100 text-sm text-gray-700 space-y-2">
        <p className="font-semibold text-gray-900">Regras de pagamento</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>30 dias grátis só no primeiro acesso (trial).</li>
          <li>Cada pagamento confirmado = +30 dias de uso.</li>
          <li>Cartão: libera ao confirmar e renova automaticamente (à vista, sem parcelas).</li>
          <li>PIX: libera ao confirmar; todo mês é gerada uma nova cobrança PIX.</li>
        </ul>
      </div>

      <div className="mb-6 p-4 rounded-2xl bg-[#eef4f5] border border-[#047482]/15 text-sm text-gray-700 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-gray-900">
          <Shield className="w-4 h-4 text-[#047482]" />
          Privacidade e seus dados
        </div>
        <p>
          Exporte metadados operacionais (agenda, clientes, financeiro) em CSV quando quiser.
        </p>
        <Link
          href="/backup"
          className="inline-flex items-center gap-2 text-[#047482] font-medium hover:underline"
        >
          <Download className="w-4 h-4" />
          Exportar backup (CSV)
        </Link>
        <p>
          Para exercer direitos previstos na LGPD (acesso, correção, portabilidade, exclusão),
          envie e-mail para{' '}
          <a href={`mailto:${PRIVACY_CONTACT}`} className="text-[#047482] font-medium hover:underline">
            {PRIVACY_CONTACT}
          </a>{' '}
          com o assunto &quot;Direitos do titular&quot; e o e-mail da sua conta.
        </p>
        <p>
          Detalhes em{' '}
          <Link href="/privacidade" className="text-[#047482] font-medium hover:underline">
            Política de privacidade
          </Link>
          .
        </p>
      </div>

      {isExpired && (
        <div className="space-y-4 mb-6">
          <div className="p-5 rounded-2xl bg-red-50 border border-red-100">
            <h2 className="font-semibold text-red-900 mb-2">Acesso bloqueado</h2>
            <p className="text-sm text-red-800">
              O app reativa automaticamente quando o Asaas confirmar o pagamento. Use o botão acima.
            </p>
            {messages.boletoFirstPaymentWarning && (
              <p className="text-sm text-red-900 font-medium mt-3">
                Boleto: aguarde a compensação no banco para liberar o acesso.
              </p>
            )}
          </div>

          <Link
            href="/backup"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-[#047482] text-[#047482] font-semibold hover:bg-[#eef4f5] transition"
          >
            <Download className="w-5 h-5" />
            Exportar backup (CSV)
          </Link>
        </div>
      )}

      <p className="text-sm text-gray-500">
        Alteração de plano em{' '}
        <Link href="/dashboard/perfil" className="text-[#047482] font-medium hover:underline">
          Meu perfil
        </Link>
        .
      </p>
    </div>
  );
}
