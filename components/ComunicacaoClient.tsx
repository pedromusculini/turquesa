'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Link2,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import type { MensagensWhatsappConfig, MensagemTipo } from '@/lib/mensagensWhatsapp';
import { renderMensagem } from '@/lib/mensagensWhatsapp';
import {
  ensureRequiredPlaceholders,
  MENSAGEM_TIPO_INFO,
  PREVIEW_SAMPLE_VARS,
} from '@/lib/mensagemTemplate';
import MensagemTemplateEditor from '@/components/MensagemTemplateEditor';
import MensagemPreviewReadOnly from '@/components/MensagemPreviewReadOnly';

const DIAS = [
  { v: 1, l: 'Segunda' },
  { v: 2, l: 'Terça' },
  { v: 3, l: 'Quarta' },
  { v: 4, l: 'Quinta' },
  { v: 5, l: 'Sexta' },
  { v: 6, l: 'Sábado' },
  { v: 0, l: 'Domingo' },
];

type DispRow = {
  medico_nome: string | null;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  duracao_minutos: number;
};

const MSG_KEYS: { key: MensagemTipo; label: string }[] = [
  { key: 'convite_agendamento', label: 'Convite para agendar' },
  { key: 'lembrete_7_dias', label: 'Lembrete 7 dias antes' },
  { key: 'lembrete_1_dia', label: 'Lembrete 1 dia antes' },
  { key: 'confirmacao_apos_agendar', label: 'Confirmação após reserva' },
];

type MsgViewMode = 'editar' | 'ver';

export default function ComunicacaoClient() {
  const [tab, setTab] = useState<'mensagens' | 'horarios' | 'link'>('mensagens');
  const [config, setConfig] = useState<MensagensWhatsappConfig | null>(null);
  const [defaults, setDefaults] = useState<MensagensWhatsappConfig | null>(null);
  const [slugUrl, setSlugUrl] = useState<string | null>(null);
  const [slugNome, setSlugNome] = useState('');
  const [disp, setDisp] = useState<DispRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [openMsg, setOpenMsg] = useState<MensagemTipo | null>('convite_agendamento');
  const [msgMode, setMsgMode] = useState<Record<MensagemTipo, MsgViewMode>>({
    convite_agendamento: 'editar',
    lembrete_7_dias: 'editar',
    lembrete_1_dia: 'editar',
    confirmacao_apos_agendar: 'editar',
  });

  function previewSnippet(tipo: MensagemTipo, template: string): string {
    const tpl = ensureRequiredPlaceholders(template, tipo);
    return renderMensagem(tpl, PREVIEW_SAMPLE_VARS);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [mRes, sRes, dRes, pRes] = await Promise.all([
      fetch('/api/perfil/mensagens-whatsapp'),
      fetch('/api/agenda/slug'),
      fetch('/api/agenda/disponibilidade'),
      fetch('/api/perfil'),
    ]);
    const m = await mRes.json();
    const s = await sRes.json();
    const d = await dRes.json();
    const p = await pRes.json();
    const cfg = m.config as MensagensWhatsappConfig;
    const defs = m.defaults as MensagensWhatsappConfig;
    const normalized = { ...cfg };
    for (const { key } of MSG_KEYS) {
      normalized[key] = ensureRequiredPlaceholders(cfg[key], key);
    }
    setConfig(normalized);
    setDefaults(defs);
    setSlugUrl(s.url || null);
    setSlugNome(s.nome_exibicao || p.profile?.clinic_name || p.profile?.full_name || '');
    setDisp(
      (d.disponibilidade || []).map((row: Record<string, unknown>) => ({
        medico_nome: row.medico_nome as string | null,
        dia_semana: row.dia_semana as number,
        hora_inicio: String(row.hora_inicio).slice(0, 5),
        hora_fim: String(row.hora_fim).slice(0, 5),
        duracao_minutos: (row.duracao_minutos as number) || 40,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function salvarMensagens() {
    if (!config) return;
    setSaving(true);
    setMsg(null);
    const res = await fetch('/api/perfil/mensagens-whatsapp', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    setSaving(false);
    if (res.ok) setMsg('Mensagens salvas.');
    else setMsg('Erro ao salvar.');
  }

  async function gerarSlug() {
    setSaving(true);
    const res = await fetch('/api/agenda/slug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome_exibicao: slugNome }),
    });
    const d = await res.json();
    setSaving(false);
    if (res.ok) {
      setSlugUrl(d.url);
      setMsg('Link de agendamento ativo.');
    }
  }

  async function salvarDisp() {
    setSaving(true);
    const res = await fetch('/api/agenda/disponibilidade', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disponibilidade: disp }),
    });
    setSaving(false);
    if (res.ok) setMsg('Horários salvos.');
  }

  function addDisp() {
    setDisp((prev) => [
      ...prev,
      {
        medico_nome: null,
        dia_semana: 1,
        hora_inicio: '08:00',
        hora_fim: '12:00',
        duracao_minutos: 40,
      },
    ]);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#228B22]" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-1">
          Mensagens WhatsApp, horários de atendimento e link público para pacientes agendarem.
        </p>
      </div>

      <div className="flex gap-1 mb-6 p-1 bg-gray-100 rounded-xl overflow-x-auto">
        {(
          [
            { id: 'mensagens' as const, label: 'Mensagens' },
            { id: 'horarios' as const, label: 'Horários' },
            { id: 'link' as const, label: 'Link público' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-[88px] py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              tab === t.id ? 'bg-white text-[#228B22] shadow-sm' : 'text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <div className="mb-4 p-3 rounded-xl bg-[#f4fff4] text-[#228B22] text-sm">{msg}</div>
      )}

      {tab === 'mensagens' && config && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#90EE90]/50 bg-[#f4fff4] px-4 py-3 text-sm text-gray-800">
            <p className="font-semibold text-[#228B22] mb-2">Como personalizar</p>
            <ol className="list-decimal pl-5 space-y-1 text-xs text-gray-700">
              <li>Abra uma mensagem abaixo</li>
              <li>
                Em <strong>Personalizar</strong>, edite só o texto (caixas brancas); nome, data e
                links são automáticos
              </li>
              <li>
                Use <strong>Ver mensagem final</strong> para conferir como o paciente verá no
                WhatsApp
              </li>
              <li>Salve todas as mensagens no final</li>
            </ol>
          </div>

          <div className="space-y-3">
            {MSG_KEYS.map(({ key, label }) => {
              const isOpen = openMsg === key;
              const mode = msgMode[key];
              const info = MENSAGEM_TIPO_INFO[key];
              const snippet = previewSnippet(key, config[key]);

              return (
                <div
                  key={key}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenMsg(isOpen ? null : key)}
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50/80 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{label}</span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{info.quando}</p>
                      {!isOpen && (
                        <p className="text-xs text-gray-600 mt-2 line-clamp-2 bg-[#f8f9fa] rounded-lg px-2 py-1.5 border border-gray-100">
                          {snippet}
                        </p>
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-gray-100 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
                        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                          <button
                            type="button"
                            onClick={() =>
                              setMsgMode((m) => ({ ...m, [key]: 'editar' }))
                            }
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                              mode === 'editar'
                                ? 'bg-white text-[#228B22] shadow-sm'
                                : 'text-gray-600'
                            }`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Personalizar
                          </button>
                          <button
                            type="button"
                            onClick={() => setMsgMode((m) => ({ ...m, [key]: 'ver' }))}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                              mode === 'ver'
                                ? 'bg-white text-[#228B22] shadow-sm'
                                : 'text-gray-600'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver mensagem final
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            defaults &&
                            setConfig((c) =>
                              c
                                ? {
                                    ...c,
                                    [key]: ensureRequiredPlaceholders(
                                      defaults[key],
                                      key,
                                    ),
                                  }
                                : c,
                            )
                          }
                          className="text-xs text-[#228B22] flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Restaurar padrão
                        </button>
                      </div>

                      {mode === 'editar' ? (
                        <MensagemTemplateEditor
                          tipo={key}
                          value={config[key]}
                          onChange={(v) =>
                            setConfig((c) =>
                              c
                                ? {
                                    ...c,
                                    [key]: ensureRequiredPlaceholders(v, key),
                                  }
                                : c,
                            )
                          }
                          onVerCompleta={() =>
                            setMsgMode((m) => ({ ...m, [key]: 'ver' }))
                          }
                        />
                      ) : (
                        <MensagemPreviewReadOnly
                          tipo={key}
                          template={config[key]}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={salvarMensagens}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#013a01] text-white font-semibold text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar todas as mensagens
          </button>
        </div>
      )}

      {tab === 'link' && (
        <div className="space-y-6">
          <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
              <Link2 className="w-5 h-5 text-[#228B22]" />
              Link público de agendamento
            </h2>
            <input
              type="text"
              value={slugNome}
              onChange={(e) => setSlugNome(e.target.value)}
              placeholder="Nome exibido para pacientes"
              className="w-full mb-3 px-4 py-3 rounded-xl border border-gray-200 text-sm"
            />
            {slugUrl ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  readOnly
                  value={slugUrl}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#f8f9fa] text-sm border border-gray-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(slugUrl);
                    setCopiado(true);
                    setTimeout(() => setCopiado(false), 2000);
                  }}
                  className="px-4 py-2 rounded-lg border border-[#228B22] text-[#228B22] text-sm font-medium flex items-center justify-center gap-1"
                >
                  {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  Copiar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={gerarSlug}
                disabled={saving}
                className="w-full py-3 rounded-xl bg-[#013a01] text-white font-semibold text-sm"
              >
                Gerar link de agendamento
              </button>
            )}
            {slugUrl && (
              <button
                type="button"
                onClick={gerarSlug}
                className="mt-2 text-xs text-gray-500 underline"
              >
                Atualizar nome / regenerar
              </button>
            )}
          </section>

          <div className="p-4 rounded-xl bg-[#f4fff4] border border-[#90EE90]/40 text-sm text-gray-700">
            <MessageSquare className="w-5 h-5 text-[#228B22] inline mr-2" />
            Lembretes são enviados manualmente pelo{' '}
            <Link href="/dashboard" className="text-[#228B22] font-semibold">
              Dashboard
            </Link>
            , com um toque no WhatsApp (7 e 1 dia antes da consulta).
          </div>
        </div>
      )}

      {tab === 'horarios' && (
        <div className="space-y-6">
          <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#228B22]" />
                Horários de atendimento
              </h2>
              <button
                type="button"
                onClick={addDisp}
                className="text-sm text-[#228B22] font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Defina os dias e horários em que você atende. Usado no agendamento online.
            </p>
            {disp.length === 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
                Nenhum horário cadastrado — pacientes não verão vagas no link público.
              </p>
            )}
            <ul className="space-y-3">
              {disp.map((row, i) => (
                <li
                  key={i}
                  className="p-3 rounded-xl border border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-2"
                >
                  <select
                    value={row.dia_semana}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setDisp((d) => {
                        const n = [...d];
                        n[i] = { ...n[i], dia_semana: v };
                        return n;
                      });
                    }}
                    className="text-xs rounded-lg border px-2 py-2"
                  >
                    {DIAS.map((d) => (
                      <option key={d.v} value={d.v}>
                        {d.l}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={row.hora_inicio}
                    onChange={(e) => {
                      setDisp((d) => {
                        const n = [...d];
                        n[i] = { ...n[i], hora_inicio: e.target.value };
                        return n;
                      });
                    }}
                    className="text-xs rounded-lg border px-2 py-2"
                  />
                  <input
                    type="time"
                    value={row.hora_fim}
                    onChange={(e) => {
                      setDisp((d) => {
                        const n = [...d];
                        n[i] = { ...n[i], hora_fim: e.target.value };
                        return n;
                      });
                    }}
                    className="text-xs rounded-lg border px-2 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => setDisp((d) => d.filter((_, j) => j !== i))}
                    className="text-red-500 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={saving}
              onClick={salvarDisp}
              className="mt-4 w-full sm:w-auto inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#013a01] text-white font-semibold text-sm"
            >
              <Save className="w-4 h-4" /> Salvar horários
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
