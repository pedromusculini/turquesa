import { supabaseAdmin } from '@/lib/supabaseClient';
import { normalizeBrazilPhone } from '@/lib/whatsapp';
import { getAppBaseUrl } from '@/lib/mensagensWhatsapp';
import { randomBytes } from 'crypto';

export type DisponibilidadeRow = {
  id: string;
  owner_email: string;
  medico_nome: string | null;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  duracao_minutos: number;
  ativo: boolean;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function generateSlugBase(nome: string): string {
  const base = slugify(nome) || 'agendar';
  const suffix = randomBytes(3).toString('hex');
  return `${base}-${suffix}`;
}

export function getAgendarPublicUrl(slug: string): string {
  return `${getAppBaseUrl()}/agendar/${slug}`;
}

export async function getSlugByOwner(ownerEmail: string) {
  const { data } = await supabaseAdmin
    .from('agendamento_slugs')
    .select('*')
    .eq('owner_email', ownerEmail.toLowerCase().trim())
    .maybeSingle();
  return data;
}

export async function getOwnerBySlug(slug: string) {
  const { data } = await supabaseAdmin
    .from('agendamento_slugs')
    .select('*')
    .eq('slug', slug.toLowerCase().trim())
    .eq('ativo', true)
    .maybeSingle();
  return data;
}

export async function upsertPacienteIndex(params: {
  ownerEmail: string;
  telefone: string;
  nome: string;
  clienteDriveId?: string | null;
  cpf?: string | null;
  convenio?: string | null;
}) {
  const owner = params.ownerEmail.toLowerCase().trim();
  const telefone = normalizeBrazilPhone(params.telefone);
  const { error } = await supabaseAdmin.from('pacientes_index').upsert(
    {
      owner_email: owner,
      telefone_normalizado: telefone,
      nome: params.nome.trim(),
      cliente_drive_id: params.clienteDriveId ?? null,
      cpf: params.cpf?.replace(/\D/g, '') || null,
      convenio: params.convenio ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'owner_email,telefone_normalizado' },
  );
  if (error) throw error;
}

export async function findPacienteByTelefone(ownerEmail: string, telefone: string) {
  const tel = normalizeBrazilPhone(telefone);
  const { data } = await supabaseAdmin
    .from('pacientes_index')
    .select('*')
    .eq('owner_email', ownerEmail.toLowerCase().trim())
    .eq('telefone_normalizado', tel)
    .maybeSingle();
  return data;
}

export async function resolvePacienteToken(token: string) {
  const { data } = await supabaseAdmin
    .from('paciente_agendamento_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data;
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToIsoTime(dateStr: string, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dateStr}T${pad(h)}:${pad(m)}:00`;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export async function listSlots(params: {
  ownerEmail: string;
  medico: string | null;
  dateStr: string;
}): Promise<{ inicio: string; fim: string }[]> {
  const owner = params.ownerEmail.toLowerCase().trim();
  const day = new Date(`${params.dateStr}T12:00:00`);
  const diaSemana = day.getDay();

  const { data: blocosRaw, error } = await supabaseAdmin
    .from('agenda_disponibilidade')
    .select('*')
    .eq('owner_email', owner)
    .eq('dia_semana', diaSemana)
    .eq('ativo', true);

  const blocos = (blocosRaw ?? []).filter(
    (b) =>
      !params.medico ||
      !b.medico_nome ||
      b.medico_nome === params.medico,
  );
  if (error) throw error;
  if (blocos.length === 0) return [];

  const dayStart = new Date(`${params.dateStr}T00:00:00-03:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  let consultasQuery = supabaseAdmin
    .from('consultas_agenda')
    .select('inicio, fim, medico')
    .eq('owner_email', owner)
    .gte('inicio', dayStart.toISOString())
    .lt('inicio', dayEnd.toISOString())
    .in('status', ['agendado', 'confirmado']);

  if (params.medico) {
    consultasQuery = consultasQuery.eq('medico', params.medico);
  }

  const { data: consultas } = await consultasQuery;
  const ocupados = (consultas ?? []).map((c) => ({
    start: new Date(c.inicio),
    end: c.fim ? new Date(c.fim) : new Date(new Date(c.inicio).getTime() + 40 * 60 * 1000),
  }));

  const slots: { inicio: string; fim: string }[] = [];
  const now = Date.now();

  for (const bloco of blocos as DisponibilidadeRow[]) {
    if (params.medico && bloco.medico_nome && bloco.medico_nome !== params.medico) continue;
    const startMin = parseTimeToMinutes(bloco.hora_inicio.slice(0, 5));
    const endMin = parseTimeToMinutes(bloco.hora_fim.slice(0, 5));
    const dur = bloco.duracao_minutos || 40;

    for (let t = startMin; t + dur <= endMin; t += dur) {
      const inicioLocal = minutesToIsoTime(params.dateStr, t);
      const fimLocal = minutesToIsoTime(params.dateStr, t + dur);
      const start = new Date(`${inicioLocal}-03:00`);
      const end = new Date(`${fimLocal}-03:00`);
      if (start.getTime() < now) continue;
      const busy = ocupados.some((o) => overlaps(start, end, o.start, o.end));
      if (!busy) {
        slots.push({ inicio: start.toISOString(), fim: end.toISOString() });
      }
    }
  }

  slots.sort((a, b) => a.inicio.localeCompare(b.inicio));
  return slots;
}

export function maskNome(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

export function formatEnderecoPerfil(profile: Record<string, unknown>): string {
  const parts: string[] = [];
  const street = profile.street as string | undefined;
  const num = profile.address_number as string | undefined;
  const neighborhood = profile.neighborhood as string | undefined;
  const city = profile.city as string | undefined;
  const state = profile.state as string | undefined;
  if (street) {
    let rua = street;
    if (num) rua += `, ${num}`;
    parts.push(rua);
  }
  if (neighborhood) parts.push(neighborhood);
  if (city) parts.push(state ? `${city}/${state}` : city);
  if (parts.length === 0 && profile.address) parts.push(String(profile.address));
  return parts.join(' — ');
}
