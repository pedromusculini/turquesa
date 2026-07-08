'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';
import ConfiguracoesSubNav, { resolveConfiguracoesTab } from '@/components/ConfiguracoesSubNav';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Link2,
  Loader2,
  MessageSquare,
  Pencil,
  RotateCcw,
  Save,
} from 'lucide-react';
import {
  resolveMensagensConfig,
  type MensagensWhatsappConfig,
  type MensagemTipo,
} from '@/lib/mensagensWhatsapp';
import { renderMensagem } from '@/lib/mensagensWhatsapp';
import {
  ensureRequiredPlaceholders,
  MENSAGEM_TIPO_INFO,
  PLACEHOLDER_LABELS,
  previewVarsFromProfile,
} from '@/lib/mensagemTemplate';
import { isEnderecoPerfilCompleto } from '@/lib/agendamento';
import MensagemTemplateEditor from '@/components/MensagemTemplateEditor';
import MensagemPreviewReadOnly from '@/components/MensagemPreviewReadOnly';
import {
  DEFAULT_LEMBRETES_SETTINGS_UI,
  formatLembretesResumoAntesSessao,
  mensagemLembreteLabel,
  mensagemLembreteQuando,
  type LembretesSettingsUi,
} from '@/lib/lembretesCopy';
import PublicClientLinksSection from '@/components/PublicClientLinksSection';
import LembretesSettingsPanel from '@/components/LembretesSettingsPanel';
import HorariosAgendaEditor from '@/components/HorariosAgendaEditor';
import PrimeirosPassosHint from '@/components/PrimeirosPassosHint';
import VerTourNovamenteButton from '@/components/VerTourNovamenteButton';
import { parseDiasInputString } from '@/lib/lembretesSettings';
import {
  expandDisponibilidadeForUi,
  normalizeDisponibilidadeForSave,
  type DispSlotInput,
} from '@/lib/disponibilidadeSlots';

function buildMedicosNomes(
  profile: Record<string, unknown> | null,
  team: Array<{ nome?: string | null }>,
): string[] {
  const names: string[] = [];
  const titular = String(profile?.full_name ?? profile?.clinic_name ?? '').trim();
  if (titular) names.push(titular);
  for (const m of team) {
    const n = String(m.nome ?? '').trim();
    if (n && !names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
  }
  return names.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

const MSG_KEYS: { key: MensagemTipo; label?: string }[] = [
  { key: 'convite_agendamento', label: 'Convite para agendar' },
  { key: 'lembrete_7_dias' },
  { key: 'lembrete_1_dia' },
  { key: 'confirmacao_apos_agendar', label: 'Confirmação após reserva' },
];

type MsgViewMode = 'editar' | 'ver';

export default function ComunicacaoClient() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = resolveConfiguracoesTab(pathname, searchParams.get('tab'));
  const contentTab = tab === 'pagamento' || tab === 'anamnese' ? 'mensagens' : tab;
  const [config, setConfig] = useState<MensagensWhatsappConfig | null>(null);
  const [defaults, setDefaults] = useState<MensagensWhatsappConfig | null>(null);
  const [slugUrl, setSlugUrl] = useState<string | null>(null);
  const [slugNome, setSlugNome] = useState('');
  const [disp, setDisp] = useState<DispSlotInput[]>([]);
  const [medicosNomes, setMedicosNomes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [lembretesSettings, setLembretesSettings] = useState<LembretesSettingsUi>(
    DEFAULT_LEMBRETES_SETTINGS_UI,
  );
  const [openMsg, setOpenMsg] = useState<MensagemTipo | null>('convite_agendamento');
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [msgMode, setMsgMode] = useState<Record<MensagemTipo, MsgViewMode>>({
    convite_agendamento: 'editar',
    lembrete_7_dias: 'editar',
    lembrete_1_dia: 'editar',
    confirmacao_apos_agendar: 'editar',
  });

  const previewVars = useMemo(() => previewVarsFromProfile(profile), [profile]);
  const enderecoCompleto = profile ? isEnderecoPerfilCompleto(profile) : false;

  function previewSnippet(tipo: MensagemTipo, template: string): string {
    const tpl = ensureRequiredPlaceholders(template, tipo);
    return renderMensagem(tpl, previewVars, tipo);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [mRes, sRes, dRes, pRes, medsRes] = await Promise.all([
      fetch('/api/perfil/mensagens-whatsapp'),
      fetch('/api/agenda/slug'),
      fetch('/api/agenda/disponibilidade'),
      fetch('/api/perfil'),
      fetch('/api/perfil/medicos'),
    ]);
    const m = (await mRes.json().catch(() => ({}))) as {
      config?: Partial<MensagensWhatsappConfig>;
      defaults?: Partial<MensagensWhatsappConfig>;
      lembretesSettings?: LembretesSettingsUi;
      error?: string;
    };
    if (m.lembretesSettings) {
      setLembretesSettings({ ...DEFAULT_LEMBRETES_SETTINGS_UI, ...m.lembretesSettings });
    }
    const s = await sRes.json();
    const d = await dRes.json();
    const p = await pRes.json();
    const defs = resolveMensagensConfig(m.defaults);
    const cfg = resolveMensagensConfig(m.config ?? defs);
    const normalized = resolveMensagensConfig(cfg);
    for (const { key } of MSG_KEYS) {
      normalized[key] = ensureRequiredPlaceholders(normalized[key], key);
    }
    setConfig(normalized);
    setDefaults(defs);
    if (!mRes.ok) {
      setMsg(
        typeof m.error === 'string' ? m.error : 'Erro ao carregar mensagens; usando padrões.',
      );
    }
    setSlugUrl(s.url || null);
    setSlugNome(s.nome_exibicao || p.profile?.clinic_name || p.profile?.full_name || '');
    const profileRow = (p.profile as Record<string, unknown>) ?? null;
    setProfile(profileRow);
    const medsJson = medsRes.ok
      ? ((await medsRes.json().catch(() => ({}))) as {
          medicos?: Array<{ nome?: string | null }>;
        })
      : {};
    setMedicosNomes(buildMedicosNomes(profileRow, medsJson.medicos ?? []));
    setDisp(
      expandDisponibilidadeForUi(
        (d.disponibilidade || []).map((row: Record<string, unknown>) => ({
          medico_nome: row.medico_nome as string | null,
          dia_semana: row.dia_semana as number,
          hora_inicio: String(row.hora_inicio).slice(0, 5),
          hora_fim: String(row.hora_fim).slice(0, 5),
          duracao_minutos: (row.duracao_minutos as number) || 40,
        })),
      ),
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
    const dias = parseDiasInputString(String(lembretesSettings.lembrete_antecedencia_dias));
    const lembretesPayload = {
      ...lembretesSettings,
      lembrete_antecedencia_dias: dias,
    };
    const res = await fetch('/api/perfil/mensagens-whatsapp', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, lembretesSettings: lembretesPayload }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      if (data.config) {
        const saved = resolveMensagensConfig(data.config as Partial<MensagensWhatsappConfig>);
        for (const { key } of MSG_KEYS) {
          saved[key] = ensureRequiredPlaceholders(saved[key], key);
        }
        setConfig(saved);
      }
      if (data.lembretesSettings) {
        setLembretesSettings({ ...DEFAULT_LEMBRETES_SETTINGS_UI, ...data.lembretesSettings });
      } else {
        setLembretesSettings(lembretesPayload);
      }
      setMsg('Mensagens e prazos dos lembretes salvos.');
    } else {
      setMsg(typeof data.error === 'string' ? data.error : 'Erro ao salvar.');
    }
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
    const payload = normalizeDisponibilidadeForSave(disp);
    const res = await fetch('/api/agenda/disponibilidade', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disponibilidade: payload }),
    });
    setSaving(false);
    if (res.ok) {
      setDisp(payload);
      setMsg('Horários salvos.');
    } else {
      const data = await res.json().catch(() => ({}));
      setMsg(typeof data.error === 'string' ? data.error : 'Erro ao salvar horários.');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#047482]" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-1">
          Mensagens WhatsApp, horários de atendimento e link público para clientes agendarem.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <VerTourNovamenteButton variant="link" />
        </div>
      </div>

      <PrimeirosPassosHint
        hintId="hint-config-mensagens"
        title="Mensagens WhatsApp"
        message="Personalize convites, confirmações e lembretes. Salve no final para aplicar em todos os envios."
      />

      <ConfiguracoesSubNav />

      {msg && (
        <div className="mb-4 p-3 rounded-xl bg-[#eef4f5] text-[#047482] text-sm">{msg}</div>
      )}

      {contentTab === 'mensagens' && config && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#3795a1]/50 bg-[#eef4f5] px-4 py-3 text-sm text-gray-800">
            <p className="font-semibold text-[#047482] mb-2">Como personalizar</p>
            <ol className="list-decimal pl-5 space-y-1 text-xs text-gray-700">
              <li>Abra uma mensagem abaixo</li>
              <li>
                Em <strong>Personalizar</strong>, edite só o texto (caixas brancas); nome, data e
                links são automáticos
              </li>
              <li>
                Use <strong>Ver mensagem final</strong> para conferir como o cliente verá no
                WhatsApp
              </li>
              <li>Salve todas as mensagens no final</li>
            </ol>
            <p className="mt-3 text-xs text-gray-700">
              <strong>Variáveis automáticas:</strong>{' '}
              {Object.entries(PLACEHOLDER_LABELS)
                .map(([token, label]) => `${token} (${label})`)
                .join(' · ')}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Para mensagens mais legíveis no WhatsApp, prefira{' '}
              <code className="text-[11px]">{'{{link_curto}}'}</code> e{' '}
              <code className="text-[11px]">{'{{link_calendario_curto}}'}</code> em vez dos
              links completos. O endereço vai como texto; o Maps fica no evento ao adicionar à
              agenda. Restaurar padrão aplica o novo formato.
            </p>
          </div>

          <div data-tour="config-lembretes-prazos">
            <LembretesSettingsPanel
              value={lembretesSettings}
              onChange={setLembretesSettings}
            />
          </div>

          {!enderecoCompleto && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold mb-1">Endereço incompleto</p>
              <p className="text-xs">
                Preencha rua e cidade em{' '}
                <Link href="/dashboard/perfil" className="text-[#047482] font-semibold underline">
                  Meu Perfil
                </Link>{' '}
                para incluir o local nas mensagens e no evento ao adicionar à agenda.
                A prévia usa dados de exemplo até lá.
              </p>
            </div>
          )}

          <div className="space-y-3" data-tour="config-mensagens-templates">
            {MSG_KEYS.map(({ key, label: labelFixed }) => {
              const isOpen = openMsg === key;
              const mode = msgMode[key];
              const info = MENSAGEM_TIPO_INFO[key];
              const label =
                labelFixed ??
                (key === 'lembrete_7_dias' || key === 'lembrete_1_dia'
                  ? mensagemLembreteLabel(key, lembretesSettings)
                  : info.titulo);
              const quandoDesc =
                key === 'lembrete_7_dias' || key === 'lembrete_1_dia'
                  ? mensagemLembreteQuando(key, lembretesSettings)
                  : info.quando;
              const snippet = previewSnippet(key, config[key]);
              const lembreteDesativado =
                (key === 'lembrete_7_dias' && !lembretesSettings.lembrete_antecedencia_ativo) ||
                (key === 'lembrete_1_dia' && !lembretesSettings.lembrete_1_dia_ativo);

              return (
                <div
                  key={key}
                  className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${
                    lembreteDesativado ? 'opacity-60' : ''
                  }`}
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
                      <p className="text-xs text-gray-500 mt-0.5">{quandoDesc}</p>
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
                                ? 'bg-white text-[#047482] shadow-sm'
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
                                ? 'bg-white text-[#047482] shadow-sm'
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
                          className="text-xs text-[#047482] flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Restaurar padrão
                        </button>
                      </div>

                      {mode === 'editar' ? (
                        <MensagemTemplateEditor
                          tipo={key}
                          value={config[key]}
                          previewVars={previewVars}
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
                          previewVars={previewVars}
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
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#047482] text-white font-semibold text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar mensagens e lembretes
          </button>
        </div>
      )}

      {contentTab === 'link' && (
        <div className="space-y-6" data-tour="config-link-publico">
          <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-2">
              <Link2 className="w-5 h-5 text-[#047482]" />
              Links públicos — cadastro e catálogo
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Dois endereços com o mesmo token: formulário de cadastro do cliente e vitrine de
              serviços (somente leitura). Mensagens WhatsApp separadas para cada link.
            </p>
            <PublicClientLinksSection variant="light" />
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
              <Link2 className="w-5 h-5 text-[#047482]" />
              Link público de agendamento
            </h2>
            <input
              type="text"
              value={slugNome}
              onChange={(e) => setSlugNome(e.target.value)}
              placeholder="Nome exibido para clientes"
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
                  className="px-4 py-2 rounded-lg border border-[#047482] text-[#047482] text-sm font-medium flex items-center justify-center gap-1"
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
                className="w-full py-3 rounded-xl bg-[#047482] text-white font-semibold text-sm"
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

          <div className="p-4 rounded-xl bg-[#eef4f5] border border-[#3795a1]/40 text-sm text-gray-700">
            <MessageSquare className="w-5 h-5 text-[#047482] inline mr-2" />
            Lembretes são enviados manualmente pelo{' '}
            <Link href="/dashboard" className="text-[#047482] font-semibold">
              Dashboard
            </Link>
            , com um toque no WhatsApp ({formatLembretesResumoAntesSessao(lembretesSettings)} antes
            da sessão).
          </div>
        </div>
      )}

      {contentTab === 'horarios' && (
        <HorariosAgendaEditor
          rows={disp}
          onChange={setDisp}
          medicos={medicosNomes}
          saving={saving}
          onSave={salvarDisp}
        />
      )}
    </div>
  );
}
