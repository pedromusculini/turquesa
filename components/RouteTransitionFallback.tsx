/** Skeleton leve durante soft navigation (loading.tsx). Header permanece no AppShell. */
export default function RouteTransitionFallback({
  label = 'Carregando…',
}: {
  label?: string;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6" aria-busy="true" aria-live="polite">
      <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-slate-200/80" />
      <p className="mb-6 text-sm text-slate-500">{label}</p>
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}
