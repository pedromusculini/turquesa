'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CreditCard, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import WhatsAppConsultorButton from '@/components/WhatsAppConsultorButton';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from '@/lib/legal';

export type PlanoAnualInfo = {
  value: number;
  installment_value: number;
  max_installments: number;
  is_active_payer: boolean;
};

function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PlanoAnualCard({
  annual,
  monthlyValue,
}: {
  annual: PlanoAnualInfo;
  monthlyValue: number | null;
}) {
  const [loading, setLoading] = useState<'cartao' | 'pix' | null>(null);
  const [error, setError] = useState('');
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [needsContact, setNeedsContact] = useState(annual.is_active_payer);

  const economia = monthlyValue != null ? monthlyValue * 12 - annual.value : null;

  async function open(metodo: 'cartao' | 'pix') {
    setLoading(metodo);
    setError('');
    setProfileUrl(null);
    try {
      const res = await fetch(`/api/conta/pagamento?plano=anual&metodo=${metodo}`);
      const json = await res.json();
      if (json.code === 'ANNUAL_SWITCH_CONTACT') {
        setNeedsContact(true);
        return;
      }
      if (!json.ok || !json.url) {
        setProfileUrl(typeof json.profileUrl === 'string' ? json.profileUrl : null);
        throw new Error(json.message || 'Não foi possível abrir o pagamento');
      }
      window.open(json.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao abrir pagamento');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border-2 border-[#047482] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[#047482]" aria-hidden />
        <h2 className="font-semibold text-gray-900">Plano anual — 2 meses grátis</h2>
      </div>
      <p className="mt-2 text-2xl font-bold text-[#047482]">
        {annual.max_installments}x de {brl(annual.installment_value)}
      </p>
      <p className="text-sm text-gray-600">
        ou {brl(annual.value)} à vista no PIX
        {economia != null && economia > 0 && <> · economia de {brl(economia)} no ano</>}
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
        <li>12 meses de acesso, equipe ilimitada, tudo incluso.</li>
        <li>Sem multa e sem adesão. Não renova sozinho: no fim do ano você decide.</li>
        <li>Se ainda estiver no teste, os dias grátis restantes continuam valendo.</li>
      </ul>

      {needsContact ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-gray-700">
            Você já tem a mensalidade ativa. Fale com a gente para migrar para o anual sem cobrança em
            dobro{SUPPORT_WHATSAPP ? '.' : <> — escreva para {SUPPORT_EMAIL}.</>}
          </p>
          <WhatsAppConsultorButton
            variant="solid"
            label="Migrar para o anual pelo WhatsApp"
            message="Olá! Quero migrar minha assinatura do Turquesa Agenda para o plano anual."
          />
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 p-2 text-sm text-red-800">
              <p>{error}</p>
              {profileUrl && (
                <Link href={profileUrl} className="mt-2 inline-block font-medium text-[#047482] underline">
                  Ir para Meu Perfil
                </Link>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => open('cartao')}
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#047482] py-3 font-semibold text-white transition hover:bg-[#035e6b] disabled:opacity-60"
          >
            {loading === 'cartao' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CreditCard className="h-5 w-5" />
            )}
            Anual no cartão — até {annual.max_installments}x
          </button>
          <button
            type="button"
            onClick={() => open('pix')}
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#047482]/30 bg-white py-3 font-semibold text-[#047482] transition hover:bg-[#D9F0F2]/40 disabled:opacity-60"
          >
            {loading === 'pix' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ExternalLink className="h-5 w-5" />
            )}
            Anual no PIX — à vista
          </button>
        </div>
      )}
    </div>
  );
}
