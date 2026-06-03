'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Trash2,
} from 'lucide-react';
import type {
  InternalOverview,
  TenantDetail,
  TenantHealth,
  TenantListFilter,
  TenantListItem,
} from '@/lib/internalMetrics';
import type { InternalAuditRow } from '@/lib/internalAuditLog';
import type { InternalTenantNote } from '@/lib/internalTenantNotes';
import { ADMIN_API_PREFIX, ADMIN_PANEL_PATH } from '@/lib/constants';

const FILTER_OPTIONS: { value: TenantListFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'inactive_30', label: 'Inativas 30+ dias' },
  { value: 'onboarding_pending', label: 'Onboarding pendente' },
  { value: 'unverified', label: 'E-mail não verificado' },
  { value: 'not_activated', label: 'Não ativadas' },
  { value: 'no_slug', label: 'Sem link público' },
  { value: 'sync_pending', label: 'Sync pendente' },
];

const AUDIT_LABELS: Record<string, string> = {
  view_tenant: 'Visualizou ficha',
  reset_tenant_access: 'Reset verificação',
  remove_tenant_google_access: 'Removeu login Google',
  add_internal_note: 'Adicionou nota',
};

function HealthBadges({ h }: { h: TenantHealth }) {
  const items: string[] = [];
  if (h.ativado) items.push('Ativa');
  if (!h.ativado) items.push('Não ativada');
  if (h.sync_agendamentos_pendentes > 0 || h.sync_formularios_pendentes > 0) {
    items.push(
      `Sync ${h.sync_agendamentos_pendentes + h.sync_formularios_pendentes}`,
    );
  }
  if (h.dias_sem_login !== null && h.dias_sem_login > 30) {
    items.push(`Inativa ${h.dias_sem_login}d`);
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((label) => (
        <span
          key={label}
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
            label.startsWith('Sync')
              ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
              : label.startsWith('Inativa')
                ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                : label === 'Ativa'
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                  : 'bg-red-950/70 text-red-300 border-red-800/50'
          }`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function sortByLastLogin(
  list: TenantListItem[],
  dir: 'desc' | 'asc',
): TenantListItem[] {
  return [...list].sort((a, b) => {
    const ta = a.last_login_at ? new Date(a.last_login_at).getTime() : 0;
    const tb = b.last_login_at ? new Date(b.last_login_at).getTime() : 0;
    return dir === 'desc' ? tb - ta : ta - tb;
  });
}

function YesNo({ value }: { value: boolean }) {
  return (
    <span
      className={
        value ? 'text-emerald-400 font-medium' : 'text-zinc-500'
      }
    >
      {value ? 'Sim' : 'Não'}
    </span>
  );
}

async function postTenantAccessAction(
  email: string,
  mode: 'reverify' | 'remove',
): Promise<{ ok: boolean; message: string }> {
  const label =
    mode === 'reverify'
      ? 'resetar a verificação de e-mail'
      : 'remover o registro de login Google';
  if (
    !window.confirm(
      `Confirma ${label} de ${email}?\n\nPerfil e dados no Drive não são apagados.`,
    )
  ) {
    return { ok: false, message: 'Cancelado.' };
  }
  const res = await fetch(
    `${ADMIN_API_PREFIX}/tenants/${encodeURIComponent(email)}/reset-access`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: data.error ?? 'Erro ao executar ação.' };
  }
  return { ok: true, message: data.result?.message ?? 'Concluído.' };
}

function TenantAccessActions({
  email,
  compact = false,
  onSuccess,
}: {
  email: string;
  compact?: boolean;
  onSuccess?: (message: string) => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  async function run(mode: 'reverify' | 'remove', e?: React.MouseEvent) {
    e?.stopPropagation();
    setLoading(mode);
    const result = await postTenantAccessAction(email, mode);
    setLoading(null);
    if (result.ok) onSuccess?.(result.message);
    else if (result.message !== 'Cancelado.') window.alert(result.message);
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          title="Resetar verificação de e-mail"
          disabled={!!loading}
          onClick={(e) => run('reverify', e)}
          className="btn-action inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-700 text-white text-[10px] font-semibold hover:bg-red-600 disabled:opacity-50"
        >
          {loading === 'reverify' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RotateCcw className="w-3 h-3" />
          )}
          Reset
        </button>
        <button
          type="button"
          title="Remover login Google"
          disabled={!!loading}
          onClick={(e) => run('remove', e)}
          className="btn-action inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-red-600/70 text-red-300 text-[10px] font-semibold hover:bg-red-950 disabled:opacity-50"
        >
          {loading === 'remove' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Trash2 className="w-3 h-3" />
          )}
          Excluir login
        </button>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-red-800/60 bg-red-950/30 p-5 md:p-6 shadow-lg shadow-red-950/30 space-y-4 text-sm">
      <h2 className="font-bold text-red-100">Suporte — resetar ou excluir login</h2>
      <p className="text-zinc-400 text-xs leading-relaxed">
        Não apaga perfil, clientes nem Drive. Peça ao usuário abrir{' '}
        <code className="text-[11px] bg-zinc-900 text-red-200 px-1 rounded border border-zinc-700">
          /api/auth/signout
        </code>{' '}
        e entrar de novo após a ação.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          disabled={!!loading}
          onClick={() => run('reverify')}
          className="btn-action inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-700 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
        >
          {loading === 'reverify' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
          Resetar verificação de e-mail
        </button>
        <button
          type="button"
          disabled={!!loading}
          onClick={() => run('remove')}
          className="btn-action inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-500 bg-zinc-900 text-red-300 text-sm font-semibold hover:bg-red-950 disabled:opacity-50"
        >
          {loading === 'remove' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          Excluir login Google
        </button>
      </div>
      <p className="text-[11px] text-zinc-500">
        <strong className="text-zinc-400">Reset:</strong> novo código em /auth/verificar-email.{' '}
        <strong className="text-zinc-400">Excluir login:</strong> apaga vínculo Google; próximo
        login recomeça do zero.
      </p>
    </section>
  );
}

function InternalShell({
  title,
  subtitle,
  productId,
  onRefresh,
  loading,
  children,
}: {
  title: string;
  subtitle?: string;
  productId?: string | null;
  onRefresh?: () => void;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-gradient-to-r from-red-950 via-zinc-950 to-zinc-950 border-b border-red-900/70 shadow-lg shadow-red-950/25">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-red-600/15 border border-red-500/40 shrink-0">
              <Shield className="w-6 h-6 text-red-400" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg md:text-xl font-bold text-zinc-50 truncate">
                  {title}
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-300 bg-red-950/90 border border-red-800/80 px-2 py-0.5 rounded shrink-0">
                  Painel admin
                </span>
              </div>
              {(subtitle || productId) && (
                <p className="text-xs text-zinc-500 truncate mt-0.5">
                  {subtitle}
                  {productId ? ` · ${productId}` : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/dashboard"
              className="text-xs font-medium text-zinc-500 hover:text-zinc-200 px-3 py-2 rounded-lg border border-zinc-700 hover:border-zinc-600 transition"
            >
              ← App principal
            </Link>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-700/80 text-red-200 hover:bg-red-950/60 text-sm font-semibold disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Atualizar
              </button>
            )}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

export default function InternalOpsClient() {
  const router = useRouter();
  const [overview, setOverview] = useState<InternalOverview | null>(null);
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [productId, setProductId] = useState<string | null>(null);
  const [loginSort, setLoginSort] = useState<'desc' | 'asc'>('desc');
  const [listFilter, setListFilter] = useState<TenantListFilter>('all');
  const [filteredTotal, setFilteredTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('q', search);
      if (listFilter !== 'all') params.set('filter', listFilter);
      const [ovRes, tenRes] = await Promise.all([
        fetch(`${ADMIN_API_PREFIX}/overview`),
        fetch(`${ADMIN_API_PREFIX}/tenants?${params}`),
      ]);
      if (ovRes.ok) {
        const ov = await ovRes.json();
        setOverview(ov.overview);
        setProductId(ov.product_id ?? null);
      }
      if (tenRes.ok) {
        const ten = await tenRes.json();
        setTenants(ten.tenants || []);
        setTotal(ten.total ?? 0);
        setFilteredTotal(ten.filtered_total ?? ten.tenants?.length ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [search, listFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedTenants = useMemo(
    () => sortByLastLogin(tenants, loginSort),
    [tenants, loginSort],
  );

  const toggleLoginSort = () => {
    setLoginSort((d) => (d === 'desc' ? 'asc' : 'desc'));
  };

  return (
    <InternalShell
      title="Operações internas"
      subtitle="Suporte e métricas de contas — sem dados de pacientes"
      productId={productId}
      onRefresh={load}
      loading={loading}
    >
      <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 space-y-8">
        <section className="rounded-2xl border border-red-800/50 bg-red-950/25 p-4 md:p-5 text-sm text-red-100/90">
          <p className="font-semibold text-red-200">Reset / excluir login de usuário</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Clique na <strong className="text-zinc-200">linha da conta</strong> para abrir a ficha
            completa, ou use os botões <strong className="text-zinc-200">Reset</strong> /{' '}
            <strong className="text-zinc-200">Excluir login</strong> na última coluna da tabela.
          </p>
        </section>

        {overview && (
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(
              [
                ['Contas', overview.total_accounts],
                ['E-mail verificado', overview.verified_accounts],
                ['Ativos 7d', overview.active_last_7d],
                ['Ativos 30d', overview.active_last_30d],
                ['Trial iniciado', overview.trial_started_count],
                ['Onboarding pendente', overview.onboarding_incomplete],
                ['Link agendamento', overview.with_public_slug],
                ['Contas ativadas', overview.activated_accounts],
                ['Sync pendente', overview.sync_pending_accounts],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm border-t-2 border-t-red-700/70"
              >
                <p className="text-xs font-medium text-zinc-500">{label}</p>
                <p className="text-2xl font-bold mt-1 tabular-nums text-red-400">
                  {value}
                </p>
              </div>
            ))}
          </section>
        )}

        <section className="bg-zinc-900/90 rounded-2xl border border-zinc-800 shadow-sm p-4 md:p-6">
          <form
            className="flex flex-col lg:flex-row gap-2 mb-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(q.trim());
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por e-mail ou nome da clínica…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-red-600/40"
              />
            </div>
            <select
              value={listFilter}
              onChange={(e) => setListFilter(e.target.value as TenantListFilter)}
              className="px-3 py-2.5 rounded-xl border border-zinc-700 text-sm bg-zinc-950 text-zinc-100 min-w-[200px]"
            >
              {FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-semibold"
            >
              Buscar
            </button>
          </form>

          <p className="text-xs text-zinc-500 mb-4">
            {filteredTotal} exibida(s) · {total} no cadastro · ordenado por último login (
            {loginSort === 'desc' ? 'mais recente primeiro' : 'mais antigo primeiro'})
          </p>

          {loading && tenants.length === 0 ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            </div>
          ) : sortedTenants.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-12">Nenhuma conta encontrada.</p>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-sm min-w-[1280px]">
                <thead className="text-left text-zinc-500 border-b border-zinc-800">
                  <tr>
                    <th className="px-3 py-2 font-semibold">E-mail</th>
                    <th className="px-3 py-2 font-semibold">Nome / clínica</th>
                    <th className="px-3 py-2 font-semibold">Tipo</th>
                    <th className="px-3 py-2 font-semibold">Plano</th>
                    <th className="px-3 py-2 font-semibold">Trial</th>
                    <th className="px-3 py-2 font-semibold">Verificado</th>
                    <th className="px-3 py-2 font-semibold">
                      <button
                        type="button"
                        onClick={toggleLoginSort}
                        className="inline-flex items-center gap-1 hover:text-red-400 font-semibold text-zinc-400"
                      >
                        Último login
                        {loginSort === 'desc' ? (
                          <ArrowDown className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUp className="w-3.5 h-3.5" />
                        )}
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      </button>
                    </th>
                    <th className="px-3 py-2 font-semibold text-right">Clientes</th>
                    <th className="px-3 py-2 font-semibold text-right">Consultas</th>
                    <th className="px-3 py-2 font-semibold text-center">Onboarding</th>
                    <th className="px-3 py-2 font-semibold">Saúde</th>
                    <th className="px-3 py-2 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {sortedTenants.map((t) => (
                    <tr
                      key={t.email}
                      onClick={() =>
                        router.push(
                          `${ADMIN_PANEL_PATH}/tenant/${encodeURIComponent(t.email)}`,
                        )
                      }
                      className="hover:bg-red-950/25 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-3 font-medium text-zinc-100 whitespace-nowrap">
                        {t.email}
                      </td>
                      <td className="px-3 py-3 text-zinc-400 max-w-[180px] truncate">
                        {t.display_name ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-zinc-500 capitalize">
                        {t.user_type ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-zinc-400">{t.plan ?? '—'}</td>
                      <td className="px-3 py-3">
                        <YesNo value={t.trial_started} />
                      </td>
                      <td className="px-3 py-3">
                        <YesNo value={t.email_verified} />
                      </td>
                      <td className="px-3 py-3 text-zinc-500 whitespace-nowrap text-xs">
                        {formatDate(t.last_login_at)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium">
                        {t.counts.clientes}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium">
                        {t.counts.consultas_agenda}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            t.onboarding_completed
                              ? 'bg-emerald-950/60 text-emerald-400 ring-1 ring-emerald-800/50'
                              : 'bg-amber-950/60 text-amber-300 ring-1 ring-amber-800/50'
                          }`}
                        >
                          {t.onboarding_completed ? 'OK' : 'Pend.'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <HealthBadges h={t.health} />
                      </td>
                      <td className="px-3 py-3">
                        <TenantAccessActions
                          email={t.email}
                          compact
                          onSuccess={() => load()}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </InternalShell>
  );
}

export function InternalTenantDetailClient({ email }: { email: string }) {
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [notes, setNotes] = useState<InternalTenantNote[]>([]);
  const [auditLog, setAuditLog] = useState<InternalAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const loadTenant = useCallback(() => {
    setLoading(true);
    fetch(`${ADMIN_API_PREFIX}/tenants/${encodeURIComponent(email)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setTenant(d?.tenant ?? null);
        setNotes(d?.notes ?? []);
        setAuditLog(d?.audit_log ?? []);
      })
      .finally(() => setLoading(false));
  }, [email]);

  useEffect(() => {
    loadTenant();
  }, [loadTenant]);

  async function saveNote() {
    const text = noteText.trim();
    if (!text) return;
    setNoteSaving(true);
    const res = await fetch(
      `${ADMIN_API_PREFIX}/tenants/${encodeURIComponent(email)}/notes`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      },
    );
    setNoteSaving(false);
    if (res.ok) {
      setNoteText('');
      loadTenant();
    }
  }

  if (loading) {
    return (
      <InternalShell title="Carregando…">
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        </div>
      </InternalShell>
    );
  }

  if (!tenant) {
    return (
      <InternalShell title="Conta não encontrada">
        <main className="max-w-3xl mx-auto px-4 py-12">
          <Link
            href={ADMIN_PANEL_PATH}
            className="text-sm text-red-400 font-semibold hover:text-red-300 hover:underline"
          >
            ← Voltar à lista
          </Link>
        </main>
      </InternalShell>
    );
  }

  return (
    <InternalShell
      title={tenant.email}
      subtitle={tenant.display_name ?? undefined}
    >
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <Link
          href={ADMIN_PANEL_PATH}
          className="text-sm text-red-400 font-semibold hover:text-red-300 hover:underline inline-block"
        >
          ← Lista de contas
        </Link>

        {actionMsg && (
          <p className="text-sm text-emerald-300 bg-emerald-950/40 rounded-xl px-3 py-2 border border-emerald-800/50">
            {actionMsg}
          </p>
        )}

        <TenantAccessActions
          email={email}
          onSuccess={(msg) => {
            setActionMsg(msg);
            loadTenant();
          }}
        />

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 md:p-6 shadow-sm space-y-4 text-sm">
          <h2 className="font-bold text-zinc-100">Conta</h2>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <dt className="text-zinc-500 text-xs">Tipo</dt>
              <dd className="font-medium capitalize">{tenant.user_type}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 text-xs">Plano</dt>
              <dd className="font-medium">{tenant.plan}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 text-xs">Cadastro</dt>
              <dd>{formatDate(tenant.created_at)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 text-xs">Último login</dt>
              <dd>{formatDate(tenant.last_login_at)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 text-xs">E-mail verificado</dt>
              <dd>
                <YesNo value={tenant.email_verified} />
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 text-xs">Trial</dt>
              <dd>
                <YesNo value={tenant.trial_started} /> · consumido:{' '}
                <YesNo value={tenant.trial_consumed} />
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 text-xs">Onboarding</dt>
              <dd>
                <YesNo value={tenant.onboarding_completed} />
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 text-xs">WhatsApp (conta)</dt>
              <dd>{tenant.whatsapp ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 text-xs">Cidade / UF</dt>
              <dd>
                {[tenant.cidade, tenant.estado].filter(Boolean).join(' / ') || '—'}
              </dd>
            </div>
          </dl>
        </section>

        {tenant.health && (
          <section className="rounded-2xl border border-red-900/50 bg-red-950/20 p-5 md:p-6 shadow-sm space-y-3 text-sm">
            <h2 className="font-bold text-red-100">Saúde da conta</h2>
            <HealthBadges h={tenant.health} />
            <ul className="space-y-1 text-zinc-400 text-xs">
              <li>Google sub no perfil: {tenant.health.google_sub_cadastrado ? 'Sim' : 'Não'}</li>
              <li>
                Agendamentos pendentes de sync Drive:{' '}
                <strong>{tenant.health.sync_agendamentos_pendentes}</strong>
              </li>
              <li>
                Formulários pendentes de sync Drive:{' '}
                <strong>{tenant.health.sync_formularios_pendentes}</strong>
              </li>
              <li>
                Dias sem login:{' '}
                {tenant.health.dias_sem_login ?? '—'}
              </li>
            </ul>
          </section>
        )}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 md:p-6 shadow-sm space-y-3 text-sm">
          <h2 className="font-bold text-zinc-100">Uso (agregado)</h2>
          <ul className="space-y-2 text-zinc-300">
            <li>
              <span className="text-zinc-500">Clientes cadastrados:</span>{' '}
              <strong className="tabular-nums">{tenant.counts.clientes}</strong>
            </li>
            <li>
              <span className="text-zinc-500">Consultas na agenda:</span>{' '}
              <strong className="tabular-nums">{tenant.counts.consultas_agenda}</strong>
            </li>
            <li>
              <span className="text-zinc-500">Links de formulário:</span>{' '}
              <strong className="tabular-nums">{tenant.counts.formulario_links}</strong>
            </li>
            <li>
              <span className="text-zinc-500">Agendamento público:</span>{' '}
              {tenant.flags.slug_ativo ? 'Ativo' : 'Não'}
            </li>
            <li>
              <span className="text-zinc-500">Lembretes WhatsApp:</span> antecipado{' '}
              {tenant.flags.lembrete_antecedencia_ativo
                ? `${tenant.lembrete_antecedencia_dias} dias`
                : 'desligado'}
              {' · '}1 dia{' '}
              {tenant.flags.lembrete_1_dia_ativo ? 'ligado' : 'desligado'}
            </li>
          </ul>
          <p className="text-xs text-zinc-500 pt-3 border-t border-zinc-800">
            Nenhum dado de paciente é exibido neste painel. Acesso registrado em auditoria.
          </p>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 md:p-6 shadow-sm space-y-4 text-sm">
          <h2 className="font-bold text-zinc-100">Notas internas</h2>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Ex.: ligou em 01/06, problema ao conectar Google…"
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-red-600/40"
          />
          <button
            type="button"
            disabled={noteSaving || !noteText.trim()}
            onClick={saveNote}
            className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {noteSaving ? (
              <Loader2 className="w-4 h-4 animate-spin inline" />
            ) : (
              'Salvar nota'
            )}
          </button>
          {notes.length > 0 ? (
            <ul className="space-y-2 pt-2 border-t border-zinc-800">
              {notes.map((n) => (
                <li key={n.id} className="text-xs bg-zinc-950/80 border border-zinc-800 rounded-lg p-3">
                  <p className="text-zinc-200 whitespace-pre-wrap">{n.body}</p>
                  <p className="text-zinc-500 mt-1">
                    {n.admin_email} · {formatDate(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">Nenhuma nota ainda.</p>
          )}
        </section>

        {auditLog.length > 0 && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 md:p-6 shadow-sm space-y-3 text-sm">
            <h2 className="font-bold text-zinc-100">Auditoria (ações admin)</h2>
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {auditLog.map((a) => (
                <li key={a.id} className="text-xs text-zinc-400 flex justify-between gap-2">
                  <span>
                    {AUDIT_LABELS[a.action] ?? a.action} · {a.admin_email}
                  </span>
                  <span className="shrink-0 text-zinc-600">
                    {formatDate(a.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

      </main>
    </InternalShell>
  );
}
