'use client';

import { useAppearance } from '@/components/ThemeProvider';
import { PALETTE_OPTIONS, THEME_OPTIONS } from '@/lib/visual/theme';

export default function AparenciaSettings() {
  const { theme, palette, setTheme, setPalette } = useAppearance();

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-[var(--app-text)]">Tema</h2>
        <p className="mt-1 text-sm text-[var(--app-muted)]">
          Claro para o dia. Escuro para reduzir brilho no celular à noite.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {THEME_OPTIONS.map((opt) => {
            const active = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  active
                    ? 'border-[var(--brand-primary)] bg-[var(--app-surface)] shadow-sm ring-2 ring-[var(--brand-primary)]/20'
                    : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--brand-primary)]/40'
                }`}
              >
                <span className="block text-sm font-semibold text-[var(--app-text)]">
                  {opt.label}
                </span>
                <span className="mt-1 block text-xs text-[var(--app-muted)]">
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-[var(--app-text)]">Cor</h2>
        <p className="mt-1 text-sm text-[var(--app-muted)]">
          Turquesa é o padrão do salão. Grafite e Marinho ficam mais sóbrios —
          comuns em barbearia e estúdio.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {PALETTE_OPTIONS.map((opt) => {
            const active = palette === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPalette(opt.id)}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  active
                    ? 'border-[var(--brand-primary)] bg-[var(--app-surface)] shadow-sm ring-2 ring-[var(--brand-primary)]/20'
                    : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--brand-primary)]/40'
                }`}
              >
                <span
                  className="mb-3 block h-8 w-8 rounded-full"
                  style={{ backgroundColor: opt.swatch }}
                  aria-hidden
                />
                <span className="block text-sm font-semibold text-[var(--app-text)]">
                  {opt.label}
                </span>
                <span className="mt-1 block text-xs text-[var(--app-muted)]">
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
