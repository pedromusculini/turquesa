'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';

function ChoosePlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'medico';
  const email = searchParams.get('email') || '';
  
  const [emailInput, setEmailInput] = useState(email);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!selectedPlan) {
      setError('Selecione um plano para continuar.');
      return;
    }
    
    const userEmail = emailInput.trim();
    if (!userEmail || !userEmail.includes('@')) {
      setError('Digite seu e-mail para receber o código de verificação.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, role, plan: selectedPlan }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text ? JSON.parse(text).error || 'Erro ao enviar código' : 'Erro ao enviar código');
      }

      router.push(`/auth/verify-code?email=${encodeURIComponent(userEmail)}&role=${role}&plan=${selectedPlan}`);
    } catch (err: any) {
      setError(err.message || 'Erro ao processar');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-10">
        <div className="text-center mb-8">
          <ShieldCheck className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">Escolha seu plano</h1>
          <p className="text-gray-500 mt-2">
            {role === 'medico' ? 'Médico Solo' : 'Clínica'}
          </p>
        </div>

        {/* Campo de email */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Seu e-mail
          </label>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="seu@email.com"
            className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {role === 'medico' ? (
            <button
              onClick={() => setSelectedPlan('medico-pix')}
              className={`rounded-2xl border-2 p-6 text-left transition ${
                selectedPlan === 'medico-pix'
                  ? 'border-green-500 bg-green-50 shadow-md'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <CheckCircle2 className={`h-6 w-6 mb-3 ${selectedPlan === 'medico-pix' ? 'text-green-600' : 'text-gray-300'}`} />
              <p className="text-xl font-bold text-gray-900">Médico Solo</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">R$ 119</p>
              <p className="text-sm text-gray-500">/mês</p>
              <p className="mt-4 text-sm text-gray-600">Teste grátis por 30 dias.</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">✓ Agenda inteligente</li>
                <li className="flex items-center gap-2">✓ Lembretes WhatsApp</li>
                <li className="flex items-center gap-2">✓ Financeiro integrado</li>
                <li className="flex items-center gap-2">✓ Suporte prioritário</li>
              </ul>
            </button>
          ) : (
            <>
              <button
                onClick={() => setSelectedPlan('clinica-5-pix')}
                className={`rounded-2xl border-2 p-6 text-left transition ${
                  selectedPlan === 'clinica-5-pix'
                    ? 'border-green-500 bg-green-50 shadow-md'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <CheckCircle2 className={`h-6 w-6 mb-3 ${selectedPlan === 'clinica-5-pix' ? 'text-green-600' : 'text-gray-300'}`} />
                <p className="text-xl font-bold text-gray-900">Clínica até 5</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">R$ 390</p>
                <p className="text-sm text-gray-500">/mês</p>
                <p className="mt-4 text-sm text-gray-600">Até 5 médicos.</p>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">✓ Agenda multi-médico</li>
                  <li className="flex items-center gap-2">✓ Lembretes WhatsApp</li>
                  <li className="flex items-center gap-2">✓ Financeiro integrado</li>
                  <li className="flex items-center gap-2">✓ Relatórios avançados</li>
                </ul>
              </button>

              <button
                onClick={() => setSelectedPlan('clinica-10-pix')}
                className={`rounded-2xl border-2 p-6 text-left transition ${
                  selectedPlan === 'clinica-10-pix'
                    ? 'border-green-500 bg-green-50 shadow-md'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <CheckCircle2 className={`h-6 w-6 mb-3 ${selectedPlan === 'clinica-10-pix' ? 'text-green-600' : 'text-gray-300'}`} />
                <p className="text-xl font-bold text-gray-900">Clínica até 10</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">R$ 449</p>
                <p className="text-sm text-gray-500">/mês</p>
                <p className="mt-4 text-sm text-gray-600">Até 10 médicos.</p>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">✓ Agenda multi-médico</li>
                  <li className="flex items-center gap-2">✓ Lembretes WhatsApp</li>
                  <li className="flex items-center gap-2">✓ Financeiro integrado</li>
                  <li className="flex items-center gap-2">✓ Relatórios avançados</li>
                </ul>
              </button>
            </>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 text-sm text-gray-600 hover:text-gray-900"
          >
            Voltar
          </button>
          <button
            onClick={handleContinue}
            disabled={!selectedPlan || loading}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {loading ? 'Enviando código...' : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChoosePlanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    }>
      <ChoosePlanContent />
    </Suspense>
  );
}