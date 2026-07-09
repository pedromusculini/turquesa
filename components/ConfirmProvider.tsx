'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
};

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useBodyScrollLock(!!state);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve });
      setBusy(false);
      busyRef.current = false;
    });
  }, []);

  const close = useCallback(
    (result: boolean) => {
      if (busyRef.current) return;
      state?.resolve(result);
      setState(null);
    },
    [state],
  );

  const value = useMemo(() => ({ confirm }), [confirm]);

  const dialog =
    state && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[260] flex items-end sm:items-center justify-center bg-black/50 p-4">
            <div
              className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`rounded-xl p-2 ${
                    state.variant === 'danger' ? 'bg-red-100' : 'bg-amber-100'
                  }`}
                >
                  <AlertTriangle
                    className={`h-5 w-5 ${
                      state.variant === 'danger' ? 'text-red-700' : 'text-amber-700'
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="confirm-title" className="text-lg font-semibold text-gray-900">
                    {state.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{state.message}</p>
                </div>
              </div>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => close(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {state.cancelLabel ?? 'Cancelar'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    busyRef.current = true;
                    setBusy(true);
                    close(true);
                  }}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${
                    state.variant === 'danger'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-[#047482] hover:bg-[#035e6b]'
                  }`}
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {state.confirmLabel ?? 'Confirmar'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {dialog}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm deve ser usado dentro de ConfirmProvider');
  }
  return ctx;
}
