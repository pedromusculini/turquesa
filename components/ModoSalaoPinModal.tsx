'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import { VERIFICATION_CODE_DIGITS } from '@/lib/constants';

type Mode = 'unlock' | 'reset-send' | 'reset-confirm';

type Props = {
  open: boolean;
  locked?: boolean;
  title?: string;
  onUnlocked: () => void;
  onClose?: () => void;
};

export default function ModoSalaoPinModal({
  open,
  locked = false,
  title = 'Modo salão',
  onUnlocked,
  onClose,
}: Props) {
  const [mode, setMode] = useState<Mode>('unlock');
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetFields = useCallback(() => {
    setPin('');
    setNewPin('');
    setNewPinConfirm('');
    setOtp('');
    setError('');
    setInfo('');
    setMode('unlock');
  }, []);

  useEffect(() => {
    if (open) {
      resetFields();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, resetFields]);

  useEffect(() => {
    if (locked) setMode('reset-send');
  }, [locked]);

  if (!open) return null;

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/financeiro/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'PIN incorreto');
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desbloquear');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendReset() {
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/financeiro/unlock/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'send' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar código');
      setInfo(data.message || 'Código enviado para seu e-mail Google.');
      setMode('reset-confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar código');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/financeiro/unlock/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'confirm',
          otp,
          newPin,
          newPinConfirm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao redefinir PIN');
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao redefinir PIN');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modo-salao-pin-title"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#047482]/10">
            {locked ? (
              <Lock className="h-5 w-5 text-[#047482]" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-[#047482]" />
            )}
          </div>
          <div>
            <h2 id="modo-salao-pin-title" className="text-lg font-bold text-gray-900">
              {title}
            </h2>
            <p className="text-sm text-gray-500">
              {locked
                ? 'PIN bloqueado. Redefina pelo e-mail da conta.'
                : 'Informe o PIN de 6 dígitos para continuar.'}
            </p>
          </div>
        </div>

        {mode === 'unlock' && !locked && (
          <form onSubmit={handleUnlock} className="space-y-4">
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={VERIFICATION_CODE_DIGITS}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, VERIFICATION_CODE_DIGITS))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-center text-2xl tracking-[0.5em] focus:border-[#047482] focus:outline-none focus:ring-2 focus:ring-[#047482]/20"
              placeholder="••••••"
              aria-label="PIN de 6 dígitos"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || pin.length !== VERIFICATION_CODE_DIGITS}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#047482] py-3 font-semibold text-white disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Desbloquear'}
            </button>
            <button
              type="button"
              onClick={() => {
                setError('');
                setMode('reset-send');
              }}
              className="w-full text-sm font-medium text-[#047482] hover:underline"
            >
              Esqueci a senha
            </button>
          </form>
        )}

        {mode === 'reset-send' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Enviaremos um código de {VERIFICATION_CODE_DIGITS} dígitos para o e-mail Google desta sessão.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {info && <p className="text-sm text-green-700">{info}</p>}
            <button
              type="button"
              onClick={handleSendReset}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#047482] py-3 font-semibold text-white disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enviar código por e-mail'}
            </button>
            {!locked && (
              <button
                type="button"
                onClick={() => setMode('unlock')}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Voltar ao PIN
              </button>
            )}
          </div>
        )}

        {mode === 'reset-confirm' && (
          <form onSubmit={handleConfirmReset} className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Código do e-mail
              <input
                type="text"
                inputMode="numeric"
                maxLength={VERIFICATION_CODE_DIGITS}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, VERIFICATION_CODE_DIGITS))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-center tracking-widest"
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
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-center tracking-widest"
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
                  setNewPinConfirm(e.target.value.replace(/\D/g, '').slice(0, VERIFICATION_CODE_DIGITS))
                }
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-center tracking-widest"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={
                loading ||
                otp.length !== VERIFICATION_CODE_DIGITS ||
                newPin.length !== VERIFICATION_CODE_DIGITS ||
                newPinConfirm.length !== VERIFICATION_CODE_DIGITS
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#047482] py-3 font-semibold text-white disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Salvar novo PIN'}
            </button>
          </form>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full text-sm text-gray-500 hover:text-gray-700"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
