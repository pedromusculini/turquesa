'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ShieldCheck } from 'lucide-react';
import { VERIFICATION_CODE_DIGITS } from '@/lib/constants';

type Status = {
  enabled: boolean;
  hasPin: boolean;
  locked: boolean;
  unlocked: boolean;
  failedAttempts: number;
};

export default function ModoSalaoSegurancaClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [disablePin, setDisablePin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/config/modo-salao');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar');
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function clearPinFields() {
    setPin('');
    setPinConfirm('');
    setDisablePin('');
    setCurrentPin('');
    setNewPin('');
    setNewPinConfirm('');
  }

  async function postConfig(body: Record<string, string>) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/config/modo-salao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      setMessage(data.message || 'Salvo com sucesso.');
      clearPinFields();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const pinInputClass =
    'mt-1 w-full max-w-xs rounded-xl border border-gray-200 px-3 py-2.5 text-center tracking-widest focus:border-[#047482] focus:outline-none focus:ring-2 focus:ring-[#047482]/20';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Configurações</h1>
      <p className="mb-6 text-gray-600">Segurança do salão e proteção do financeiro.</p>


      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#047482]" />
        </div>
      ) : (
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#047482]/10">
              <ShieldCheck className="h-5 w-5 text-[#047482]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Modo salão</h2>
              <p className="mt-1 text-sm text-gray-600">
                Protege <strong>Financeiro</strong> e <strong>Backup</strong> com PIN de{' '}
                {VERIFICATION_CODE_DIGITS} dígitos. Agenda, clientes e catálogo permanecem abertos.
                Somente o titular da conta pode configurar.
              </p>
            </div>
          </div>

          {message && (
            <p className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {message}
            </p>
          )}
          {error && (
            <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          )}

          {status?.locked && (
            <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              PIN bloqueado após tentativas incorretas. Na tela de financeiro ou backup, use
              &quot;Esqueci a senha&quot; para redefinir por e-mail.
            </p>
          )}

          <div className="mb-6 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
            <span className="font-medium text-gray-800">
              Modo salão {status?.enabled ? 'ligado' : 'desligado'}
            </span>
            {status?.enabled && status.unlocked && (
              <span className="text-xs font-medium text-green-700">Financeiro desbloqueado</span>
            )}
          </div>

          {!status?.enabled ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                postConfig({ action: 'enable', pin, pinConfirm });
              }}
              className="space-y-4"
            >
              <p className="text-sm text-gray-600">
                Ao ligar, crie um PIN de {VERIFICATION_CODE_DIGITS} dígitos (evite sequências óbvias).
              </p>
              <label className="block text-sm font-medium text-gray-700">
                Novo PIN
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={VERIFICATION_CODE_DIGITS}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, VERIFICATION_CODE_DIGITS))}
                  className={pinInputClass}
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Confirmar PIN
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={VERIFICATION_CODE_DIGITS}
                  value={pinConfirm}
                  onChange={(e) =>
                    setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, VERIFICATION_CODE_DIGITS))
                  }
                  className={pinInputClass}
                />
              </label>
              <button
                type="submit"
                disabled={
                  saving ||
                  pin.length !== VERIFICATION_CODE_DIGITS ||
                  pinConfirm.length !== VERIFICATION_CODE_DIGITS
                }
                className="rounded-xl bg-[#047482] px-5 py-2.5 font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Salvando…' : 'Ligar modo salão'}
              </button>
            </form>
          ) : (
            <div className="space-y-8">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  postConfig({ action: 'disable', pin: disablePin });
                }}
                className="space-y-3 border-t border-gray-100 pt-6"
              >
                <h3 className="font-semibold text-gray-900">Desligar modo salão</h3>
                <p className="text-sm text-gray-600">Informe o PIN atual para desativar a proteção.</p>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={VERIFICATION_CODE_DIGITS}
                  value={disablePin}
                  onChange={(e) =>
                    setDisablePin(e.target.value.replace(/\D/g, '').slice(0, VERIFICATION_CODE_DIGITS))
                  }
                  className={pinInputClass}
                  aria-label="PIN atual para desligar"
                />
                <button
                  type="submit"
                  disabled={saving || disablePin.length !== VERIFICATION_CODE_DIGITS}
                  className="rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 font-semibold text-red-700 disabled:opacity-50"
                >
                  Desligar modo salão
                </button>
              </form>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  postConfig({
                    action: 'change',
                    currentPin,
                    newPin,
                    newPinConfirm,
                  });
                }}
                className="space-y-3 border-t border-gray-100 pt-6"
              >
                <h3 className="font-semibold text-gray-900">Alterar PIN</h3>
                <label className="block text-sm font-medium text-gray-700">
                  PIN atual
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={VERIFICATION_CODE_DIGITS}
                    value={currentPin}
                    onChange={(e) =>
                      setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, VERIFICATION_CODE_DIGITS))
                    }
                    className={pinInputClass}
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Novo PIN
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={VERIFICATION_CODE_DIGITS}
                    value={newPin}
                    onChange={(e) =>
                      setNewPin(e.target.value.replace(/\D/g, '').slice(0, VERIFICATION_CODE_DIGITS))
                    }
                    className={pinInputClass}
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Confirmar novo PIN
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={VERIFICATION_CODE_DIGITS}
                    value={newPinConfirm}
                    onChange={(e) =>
                      setNewPinConfirm(
                        e.target.value.replace(/\D/g, '').slice(0, VERIFICATION_CODE_DIGITS),
                      )
                    }
                    className={pinInputClass}
                  />
                </label>
                <button
                  type="submit"
                  disabled={
                    saving ||
                    currentPin.length !== VERIFICATION_CODE_DIGITS ||
                    newPin.length !== VERIFICATION_CODE_DIGITS ||
                    newPinConfirm.length !== VERIFICATION_CODE_DIGITS
                  }
                  className="rounded-xl bg-[#047482] px-5 py-2.5 font-semibold text-white disabled:opacity-50"
                >
                  Alterar PIN
                </button>
              </form>
            </div>
          )}

          <p className="mt-8 text-xs text-gray-500">
            Dúvidas? Veja também{' '}
            <Link href="/dashboard/configuracoes/pagamento" className="text-[#047482] hover:underline">
              Pagamento e taxas
            </Link>
            .
          </p>
        </section>
      )}
    </div>
  );
}
