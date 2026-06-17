'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DURACAO_MAX_MINUTOS,
  DURACAO_MIN_MINUTOS,
  DURACOES_OPCOES,
  isDuracaoMinutosValid,
} from '@/lib/disponibilidadeSlots';

function parseApiError(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

export default function ConfigAgendaSection() {
  const [usarPadrao, setUsarPadrao] = useState(false);
  const [duracaoMin, setDuracaoMin] = useState<number>(60);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/config/agenda');
      const data = (await res.json()) as {
        duracao_padrao_minutos?: number | null;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? 'Erro ao carregar configuração');
      }
      const raw = data.duracao_padrao_minutos;
      if (raw === null || raw === undefined) {
        setUsarPadrao(false);
        setDuracaoMin(60);
      } else {
        setUsarPadrao(true);
        setDuracaoMin(isDuracaoMinutosValid(raw) ? raw : 60);
      }
    } catch (e) {
      setError(parseApiError(e, 'Erro ao carregar'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = {
        duracao_padrao_minutos: usarPadrao ? duracaoMin : null,
      };
      const res = await fetch('/api/config/agenda', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        duracao_padrao_minutos?: number | null;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? 'Erro ao salvar');
      }
      const saved = data.duracao_padrao_minutos;
      if (saved === null || saved === undefined) {
        setUsarPadrao(false);
      } else {
        setUsarPadrao(true);
        setDuracaoMin(saved);
      }
      setMessage('Configuração da agenda salva.');
    } catch (e) {
      setError(parseApiError(e, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-6">
        <p className="text-sm text-gray-500">Carregando configurações da agenda...</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">Duração padrão dos agendamentos</h2>
      <p className="mt-1 text-sm text-gray-500">
        Opcional. Quando definida, novos agendamentos na agenda interna sugerem o horário de fim
        automaticamente. Você pode alterar o fim manualmente a qualquer momento. O agendamento
        público (link wa.me) continua usando a soma dos serviços escolhidos.
      </p>

      <label className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--brand-bg-onboarding)]/80 p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={usarPadrao}
          onChange={(e) => setUsarPadrao(e.target.checked)}
          className="mt-1 rounded border-gray-300 text-[var(--brand-primary)]"
        />
        <span className="text-sm text-gray-700">
          <strong>Usar duração padrão</strong> — preenche o fim ao criar um agendamento na grade.
          Sem essa opção, o horário de fim fica em branco até você informar.
        </span>
      </label>

      {usarPadrao && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duração padrão (minutos)
          </label>
          <select
            value={duracaoMin}
            onChange={(e) => setDuracaoMin(Number(e.target.value))}
            className="w-full max-w-xs rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
          >
            {DURACOES_OPCOES.map((min) => (
              <option key={min} value={min}>
                {min} min
                {min >= 60 ? ` (${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}min` : ''})` : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Entre {DURACAO_MIN_MINUTOS} e {DURACAO_MAX_MINUTOS} minutos.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="mt-6 rounded-xl bg-[#047482] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#035e6b] disabled:opacity-50"
      >
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </section>
  );
}
