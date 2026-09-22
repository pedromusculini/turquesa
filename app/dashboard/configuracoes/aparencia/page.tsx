import AparenciaSettings from '@/components/AparenciaSettings';

export default function AparenciaPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <h1 className="mb-2 text-2xl font-bold text-[var(--app-text)]">Aparência</h1>
      <p className="mb-8 text-sm text-[var(--app-muted)]">
        Vale só neste aparelho. Troca o visual do sistema, sem alterar dados do
        salão.
      </p>
      <AparenciaSettings />
    </div>
  );
}
