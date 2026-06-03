import { supabaseAdmin } from '@/lib/supabaseClient';
import { getLembretesSettings } from '@/lib/lembretesSettings';
import {
  type TenantHealth,
  type TenantListFilter,
  getHealthMapForEmails,
  matchesTenantFilter,
  daysSinceLogin,
} from '@/lib/internalTenantHealth';
export type { TenantHealth, TenantListFilter } from '@/lib/internalTenantHealth';

export type TenantListItem = {
  email: string;
  display_name: string | null;
  user_type: string | null;
  plan: string | null;
  trial_started: boolean;
  onboarding_completed: boolean;
  created_at: string | null;
  email_verified: boolean;
  last_login_at: string | null;
  trial_consumed: boolean;
  counts: {
    clientes: number;
    consultas_agenda: number;
    formulario_links: number;
  };
  flags: {
    slug_ativo: boolean;
    lembrete_antecedencia_ativo: boolean;
    lembrete_1_dia_ativo: boolean;
  };
  health: TenantHealth;
};

export type TenantDetail = TenantListItem & {
  google_sub: string | null;
  trial_started_at: string | null;
  whatsapp: string | null;
  cidade: string | null;
  estado: string | null;
  medicos_count: number | null;
  lembrete_antecedencia_dias: number;
};

function aggregateByOwner(
  rows: Array<{ owner_email: string }> | null,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of rows ?? []) {
    const key = row.owner_email?.toLowerCase().trim();
    if (!key) continue;
    map[key] = (map[key] ?? 0) + 1;
  }
  return map;
}

async function safeSlugOwners(): Promise<Array<{ owner_email: string }>> {
  const { data, error } = await supabaseAdmin
    .from('agendamento_slugs')
    .select('owner_email')
    .eq('ativo', true);
  if (error) {
    if (error.code === 'PGRST205') return [];
    throw error;
  }
  return (data ?? []) as Array<{ owner_email: string }>;
}

async function safeSelectOwnerColumn(
  table: string,
): Promise<Array<{ owner_email: string }>> {
  const { data, error } = await supabaseAdmin.from(table).select('owner_email');
  if (error) {
    if (error.code === 'PGRST205') return [];
    throw error;
  }
  return (data ?? []) as Array<{ owner_email: string }>;
}

function displayNameFromProfile(p: {
  user_type?: string | null;
  full_name?: string | null;
  clinic_name?: string | null;
}): string | null {
  if (p.user_type === 'clinica') return p.clinic_name ?? null;
  return p.full_name ?? p.clinic_name ?? null;
}

function brTodayKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const key = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [y1, m1, d1] = brTodayKey().split('-').map(Number);
  const [y2, m2, d2] = key.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t1 - t2) / 86400000);
}

const LIST_FILTER_VALUES: TenantListFilter[] = [
  'all',
  'inactive_30',
  'onboarding_pending',
  'no_slug',
  'not_activated',
  'sync_pending',
  'unverified',
];

function parseListFilter(raw: string | undefined): TenantListFilter {
  if (raw && LIST_FILTER_VALUES.includes(raw as TenantListFilter)) {
    return raw as TenantListFilter;
  }
  return 'all';
}

type OnboardingProfileRow = {
  email: string;
  user_type: string | null;
  plan: string | null;
  trial_started: boolean | null;
  onboarding_completed: boolean | null;
  full_name: string | null;
  clinic_name: string | null;
  created_at: string | null;
  google_sub: string | null;
};

type GoogleAccessRow = {
  email: string;
  email_verified_at: string | null;
  last_login_at: string | null;
  trial_consumed: boolean | null;
  created_at?: string | null;
};

function normEmail(email: string): string {
  return email.toLowerCase().trim();
}

function sortEmailsForList(
  emails: string[],
  accessByEmail: Map<string, GoogleAccessRow>,
  profilesByEmail: Map<string, OnboardingProfileRow>,
): string[] {
  return [...emails].sort((a, b) => {
    const la = accessByEmail.get(a)?.last_login_at;
    const lb = accessByEmail.get(b)?.last_login_at;
    if (la && lb) return new Date(lb).getTime() - new Date(la).getTime();
    if (la) return -1;
    if (lb) return 1;
    const ca = profilesByEmail.get(a)?.created_at;
    const cb = profilesByEmail.get(b)?.created_at;
    if (ca && cb) return new Date(cb).getTime() - new Date(ca).getTime();
    if (ca) return -1;
    if (cb) return 1;
    return a.localeCompare(b);
  });
}

function buildTenantListItem(
  email: string,
  profile: OnboardingProfileRow | undefined,
  access: GoogleAccessRow | undefined,
  clientsAgg: Record<string, number>,
  consultasAgg: Record<string, number>,
  formsAgg: Record<string, number>,
  slugSet: Set<string>,
  lembretesByEmail: Map<
    string,
    {
      lembrete_antecedencia_ativo: boolean;
      lembrete_1_dia_ativo: boolean;
    }
  >,
  health: TenantHealth,
): TenantListItem {
  const lem = lembretesByEmail.get(email);
  const slug_ativo = slugSet.has(email);
  return {
    email,
    display_name: profile ? displayNameFromProfile(profile) : null,
    user_type: profile?.user_type ?? null,
    plan: profile?.plan ?? null,
    trial_started: profile?.trial_started === true,
    onboarding_completed: profile ? profile.onboarding_completed !== false : false,
    created_at: profile?.created_at ?? access?.created_at ?? null,
    email_verified: !!access?.email_verified_at,
    last_login_at: access?.last_login_at ?? null,
    trial_consumed: access?.trial_consumed === true,
    counts: {
      clientes: clientsAgg[email] ?? 0,
      consultas_agenda: consultasAgg[email] ?? 0,
      formulario_links: formsAgg[email] ?? 0,
    },
    flags: {
      slug_ativo,
      lembrete_antecedencia_ativo: lem?.lembrete_antecedencia_ativo !== false,
      lembrete_1_dia_ativo: lem?.lembrete_1_dia_ativo !== false,
    },
    health,
  };
}

export async function listInternalTenants(params: {
  q?: string;
  limit?: number;
  offset?: number;
  filter?: string;
}): Promise<{ tenants: TenantListItem[]; total: number; filtered_total: number }> {
  const limit = Math.min(100, Math.max(1, params.limit ?? 50));
  const offset = Math.max(0, params.offset ?? 0);
  const q = params.q?.toLowerCase().trim() ?? '';
  const filter = parseListFilter(params.filter);

  const fetchCap = filter === 'all' && !q ? 200 : 300;

  let accessQuery = supabaseAdmin
    .from('google_account_access')
    .select(
      'email, email_verified_at, last_login_at, trial_consumed, created_at',
    )
    .order('last_login_at', { ascending: false, nullsFirst: false });

  let profileQuery = supabaseAdmin
    .from('onboarding_profiles')
    .select(
      'email, user_type, plan, trial_started, onboarding_completed, full_name, clinic_name, created_at, google_sub',
    )
    .order('created_at', { ascending: false });

  if (q) {
    accessQuery = accessQuery.ilike('email', `%${q}%`);
    profileQuery = profileQuery.or(
      `email.ilike.%${q}%,full_name.ilike.%${q}%,clinic_name.ilike.%${q}%`,
    );
  }

  const [{ data: accessList, error: accessErr }, { data: profiles, error: profileErr }] =
    await Promise.all([
      accessQuery.range(0, fetchCap - 1),
      profileQuery.range(0, fetchCap - 1),
    ]);

  if (accessErr) throw accessErr;
  if (profileErr) throw profileErr;

  const accessByEmail = new Map<string, GoogleAccessRow>();
  for (const a of accessList ?? []) {
    accessByEmail.set(normEmail(a.email), a as GoogleAccessRow);
  }

  const profilesByEmail = new Map<string, OnboardingProfileRow>();
  for (const p of profiles ?? []) {
    profilesByEmail.set(normEmail(p.email), p as OnboardingProfileRow);
  }

  const allEmails = new Set<string>([
    ...accessByEmail.keys(),
    ...profilesByEmail.keys(),
  ]);
  const emails = sortEmailsForList([...allEmails], accessByEmail, profilesByEmail);

  const [clientMap, consultaMap, formMap, slugRows, lembretesRows] = await Promise.all([
    safeSelectOwnerColumn('clientes'),
    safeSelectOwnerColumn('consultas_agenda'),
    safeSelectOwnerColumn('formulario_links'),
    safeSlugOwners(),
    emails.length
      ? supabaseAdmin
          .from('mensagens_whatsapp_config')
          .select(
            'owner_email, lembrete_antecedencia_ativo, lembrete_1_dia_ativo',
          )
          .in('owner_email', emails)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const clientsAgg = aggregateByOwner(clientMap);
  const consultasAgg = aggregateByOwner(consultaMap);
  const formsAgg = aggregateByOwner(formMap);

  const slugSet = new Set(
    slugRows.map((r) => r.owner_email?.toLowerCase().trim()),
  );

  const lembretesByEmail = new Map(
    (lembretesRows.data ?? []).map((l) => [normEmail(l.owner_email), l]),
  );

  const healthCtx = new Map<
    string,
    {
      last_login_at: string | null;
      google_sub: string | null;
      clientes: number;
      consultas: number;
      slug_ativo: boolean;
    }
  >();
  for (const email of emails) {
    const access = accessByEmail.get(email);
    const profile = profilesByEmail.get(email);
    healthCtx.set(email, {
      last_login_at: access?.last_login_at ?? null,
      google_sub: profile?.google_sub ?? null,
      clientes: clientsAgg[email] ?? 0,
      consultas: consultasAgg[email] ?? 0,
      slug_ativo: slugSet.has(email),
    });
  }
  const healthMap = await getHealthMapForEmails(emails, healthCtx);

  let tenants: TenantListItem[] = emails.map((email) => {
    const profile = profilesByEmail.get(email);
    const access = accessByEmail.get(email);
    return buildTenantListItem(
      email,
      profile,
      access,
      clientsAgg,
      consultasAgg,
      formsAgg,
      slugSet,
      lembretesByEmail,
      healthMap.get(email) ?? {
        google_sub_cadastrado: !!profile?.google_sub,
        sync_agendamentos_pendentes: 0,
        sync_formularios_pendentes: 0,
        ativado: false,
        dias_sem_login: daysSinceLogin(access?.last_login_at ?? null),
      },
    );
  });

  if (filter !== 'all') {
    tenants = tenants.filter((t) => matchesTenantFilter(t, filter));
  }

  const filtered_total = tenants.length;
  const paged = tenants.slice(offset, offset + limit);

  return {
    tenants: paged,
    total: allEmails.size,
    filtered_total,
  };
}

export async function getInternalTenantDetail(
  ownerEmail: string,
): Promise<TenantDetail | null> {
  const email = ownerEmail.toLowerCase().trim();

  const { data: profile, error } = await supabaseAdmin
    .from('onboarding_profiles')
    .select(
      'email, user_type, plan, trial_started, onboarding_completed, full_name, clinic_name, created_at, google_sub, whatsapp, city, state, doctors_count',
    )
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;

  const { data: access } = await supabaseAdmin
    .from('google_account_access')
    .select(
      'email_verified_at, last_login_at, trial_consumed, trial_started_at, created_at',
    )
    .eq('email', email)
    .maybeSingle();

  if (!profile && !access) return null;

  const [clientes, consultas, forms, slug, lembretes] = await Promise.all([
    supabaseAdmin
      .from('clientes')
      .select('id', { count: 'exact', head: true })
      .eq('owner_email', email),
    supabaseAdmin
      .from('consultas_agenda')
      .select('id', { count: 'exact', head: true })
      .eq('owner_email', email),
    supabaseAdmin
      .from('formulario_links')
      .select('id', { count: 'exact', head: true })
      .eq('owner_email', email),
    supabaseAdmin
      .from('agendamento_slugs')
      .select('ativo')
      .eq('owner_email', email)
      .maybeSingle(),
    getLembretesSettings(email),
  ]);

  const counts = {
    clientes: clientes.count ?? 0,
    consultas_agenda: consultas.count ?? 0,
    formulario_links: forms.count ?? 0,
  };
  const flags = {
    slug_ativo: slug.data?.ativo === true,
    lembrete_antecedencia_ativo: lembretes.lembrete_antecedencia_ativo,
    lembrete_1_dia_ativo: lembretes.lembrete_1_dia_ativo,
  };

  const healthMap = await getHealthMapForEmails(
    [email],
    new Map([
      [
        email,
        {
          last_login_at: access?.last_login_at ?? null,
          google_sub: profile?.google_sub ?? null,
          clientes: counts.clientes,
          consultas: counts.consultas_agenda,
          slug_ativo: flags.slug_ativo,
        },
      ],
    ]),
  );

  const health =
    healthMap.get(email) ?? {
      google_sub_cadastrado: !!profile?.google_sub,
      sync_agendamentos_pendentes: 0,
      sync_formularios_pendentes: 0,
      ativado: false,
      dias_sem_login: daysSinceLogin(access?.last_login_at ?? null),
    };

  const listItem: TenantListItem = profile
    ? {
        email,
        display_name: displayNameFromProfile(profile),
        user_type: profile.user_type,
        plan: profile.plan,
        trial_started: profile.trial_started === true,
        onboarding_completed: profile.onboarding_completed !== false,
        created_at: profile.created_at,
        email_verified: !!access?.email_verified_at,
        last_login_at: access?.last_login_at ?? null,
        trial_consumed: access?.trial_consumed === true,
        counts,
        flags,
        health,
      }
    : {
        email,
        display_name: null,
        user_type: null,
        plan: null,
        trial_started: false,
        onboarding_completed: false,
        created_at: access?.created_at ?? null,
        email_verified: !!access?.email_verified_at,
        last_login_at: access?.last_login_at ?? null,
        trial_consumed: access?.trial_consumed === true,
        counts,
        flags,
        health,
      };

  return {
    ...listItem,
    google_sub: profile?.google_sub ?? null,
    trial_started_at: access?.trial_started_at ?? null,
    whatsapp: profile?.whatsapp ?? null,
    cidade: profile?.city ?? null,
    estado: profile?.state ?? null,
    medicos_count: profile?.doctors_count ?? null,
    lembrete_antecedencia_dias: lembretes.lembrete_antecedencia_dias,
  };
}

export type InternalOverview = {
  total_accounts: number;
  verified_accounts: number;
  active_last_7d: number;
  active_last_30d: number;
  trial_started_count: number;
  onboarding_incomplete: number;
  with_public_slug: number;
  activated_accounts: number;
  sync_pending_accounts: number;
};

export async function getInternalOverview(): Promise<InternalOverview> {
  const { count: totalAccounts } = await supabaseAdmin
    .from('google_account_access')
    .select('email', { count: 'exact', head: true });

  const { data: accessList } = await supabaseAdmin
    .from('google_account_access')
    .select('email, email_verified_at, last_login_at');

  const { data: profiles } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('email, trial_started, onboarding_completed');

  const { count: slugCount } = await supabaseAdmin
    .from('agendamento_slugs')
    .select('id', { count: 'exact', head: true })
    .eq('ativo', true);

  let verified = 0;
  let active7 = 0;
  let active30 = 0;
  for (const a of accessList ?? []) {
    if (a.email_verified_at) verified += 1;
    const d = daysSince(a.last_login_at);
    if (d !== null && d <= 7) active7 += 1;
    if (d !== null && d <= 30) active30 += 1;
  }

  const profileByEmail = new Map(
    (profiles ?? []).map((p) => [normEmail(p.email), p]),
  );

  let trialStarted = 0;
  let onboardingIncomplete = 0;
  for (const p of profiles ?? []) {
    if (p.trial_started) trialStarted += 1;
  }
  for (const a of accessList ?? []) {
    const email = normEmail(a.email);
    const p = profileByEmail.get(email);
    if (!p || p.onboarding_completed === false) onboardingIncomplete += 1;
  }

  const { tenants: allForKpi } = await listInternalTenants({
    limit: 200,
    filter: 'all',
  });
  let activated = 0;
  let syncPending = 0;
  for (const t of allForKpi) {
    if (t.health.ativado) activated += 1;
    if (
      t.health.sync_agendamentos_pendentes > 0 ||
      t.health.sync_formularios_pendentes > 0
    ) {
      syncPending += 1;
    }
  }

  return {
    total_accounts: totalAccounts ?? 0,
    verified_accounts: verified,
    active_last_7d: active7,
    active_last_30d: active30,
    trial_started_count: trialStarted,
    onboarding_incomplete: onboardingIncomplete,
    with_public_slug: slugCount ?? 0,
    activated_accounts: activated,
    sync_pending_accounts: syncPending,
  };
}
