import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agendaTimesEqual,
  formatAgendaHorarioCompleto,
  reconcileGoogleVsSupabaseTime,
} from './agendaTimeLww.ts';

const TURQUESA = { inicio: '2026-09-04T17:00:00.000Z', fim: '2026-09-04T17:30:00.000Z' };
const GOOGLE = { inicio: '2026-09-04T18:00:00.000Z', fim: '2026-09-04T18:30:00.000Z' };
const T0 = '2026-09-04T16:00:00.000Z';
const T1 = '2026-09-04T16:02:00.000Z';
const T_LATER = '2026-09-04T16:20:00.000Z';

test('horários iguais na janela de 1 min', () => {
  assert.equal(
    agendaTimesEqual(
      { inicio: '2026-09-04T17:00:00.000Z' },
      { inicio: '2026-09-04T17:00:30.000Z' },
    ),
    true,
  );
});

test('edições simultâneas geram conflito', () => {
  const result = reconcileGoogleVsSupabaseTime({
    supabase: { ...TURQUESA, updated_at: T0 },
    google: { ...GOOGLE, updated: T1 },
  });
  assert.equal(result.action, 'needs_review');
  if (result.action === 'needs_review') {
    assert.equal(result.googleInicio, GOOGLE.inicio);
  }
});

test('depois de resolver, o mesmo google.updated não reabre conflito', () => {
  const result = reconcileGoogleVsSupabaseTime({
    supabase: {
      ...TURQUESA,
      updated_at: T1,
      google_updated_at: T1,
      sync_health: null,
    },
    google: { ...GOOGLE, updated: T1 },
  });
  assert.equal(result.action, 'keep_supabase');
});

test('conflito pendente da mesma versão Google permanece em revisão', () => {
  const result = reconcileGoogleVsSupabaseTime({
    supabase: {
      ...TURQUESA,
      updated_at: T0,
      google_updated_at: T1,
      sync_health: 'needs_review',
    },
    google: { ...GOOGLE, updated: T1 },
  });
  assert.equal(result.action, 'needs_review');
});

test('Google mais novo fora da janela aplica o horário do Google', () => {
  const result = reconcileGoogleVsSupabaseTime({
    supabase: { ...TURQUESA, updated_at: T0 },
    google: { ...GOOGLE, updated: T_LATER },
  });
  assert.equal(result.action, 'apply_google');
});

test('horários iguais não geram conflito', () => {
  const result = reconcileGoogleVsSupabaseTime({
    supabase: { ...GOOGLE, updated_at: T0 },
    google: { ...GOOGLE, updated: T1 },
  });
  assert.equal(result.action, 'unchanged');
});

test('rótulo completo distingue o mesmo relógio em dias diferentes', () => {
  const a = formatAgendaHorarioCompleto('2026-09-04T17:00:00.000Z');
  const b = formatAgendaHorarioCompleto('2026-09-05T17:00:00.000Z');
  assert.notEqual(a, b);
  assert.match(a, /14:00/);
  assert.match(b, /14:00/);
});
