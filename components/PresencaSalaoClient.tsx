'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy, Loader2, Upload, X } from 'lucide-react';
import SalaoLandingView from '@/components/SalaoLandingView';
import {
  DEFAULT_LANDING_CONFIG,
  LANDING_ESTILO_META,
  LANDING_PALETA_META,
  LANDING_PALETAS,
  landingUrlOnCurrentOrigin,
  type LandingConfig,
  type LandingPublicData,
} from '@/lib/salonLanding';
import { validateLandingCapaClient } from '@/lib/salonLandingCapa';

const BLOCO_LABELS: { key: keyof LandingConfig['blocos']; label: string }[] = [
  { key: 'agendar', label: 'Agendar horário' },
  { key: 'cadastro', label: 'Primeira visita (cadastro)' },
  { key: 'catalogo', label: 'Catálogo / preços' },
  { key: 'equipe', label: 'Profissionais' },
  { key: 'endereco', label: 'Endereço' },
  { key: 'experiencia', label: 'Texto da dona' },
];

export default function PresencaSalaoClient() {
  const [config, setConfig] = useState<LandingConfig>(DEFAULT_LANDING_CONFIG);
  const [publicData, setPublicData] = useState<LandingPublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const applyPayload = (json: { config?: LandingConfig; public?: LandingPublicData }) => {
    if (json.config) setConfig(json.config);
    if (json.public) setPublicData(json.public);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/presenca/config', { cache: 'no-store', credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar');
      applyPayload(json);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(next: LandingConfig) {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch('/api/presenca/config', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estilo: next.estilo,
          paleta: next.paleta,
          tituloHero: next.tituloHero,
          textoExperiencia: next.textoExperiencia,
          blocos: next.blocos,
          publicada: next.publicada,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar');
      applyPayload(json);
      setOk('Salvo.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function patch(partial: Partial<LandingConfig>) {
    const next = { ...config, ...partial };
    setConfig(next);
    void save(next);
  }

  async function onCapa(file: File) {
    const validation = validateLandingCapaClient(file);
    if (validation) {
      setError(validation);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/presenca/capa', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao enviar capa');
      const next = { ...config, capaUrl: json.capaUrl as string };
      setConfig(next);
      if (publicData) setPublicData({ ...publicData, capaUrl: json.capaUrl });
      setOk('Capa convertida para WebP.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar capa');
    } finally {
      setUploading(false);
    }
  }

  async function removerCapa() {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch('/api/presenca/capa', { method: 'DELETE', credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao remover');
      const next = { ...config, capaUrl: null };
      setConfig(next);
      if (publicData) setPublicData({ ...publicData, capaUrl: null });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao remover capa');
    } finally {
      setUploading(false);
    }
  }

  async function copiarUrl() {
    const url = publicData?.urls.site;
    if (!url) return;
    await navigator.clipboard.writeText(landingUrlOnCurrentOrigin(url));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const preview: LandingPublicData | null = publicData
    ? { ...publicData, ...config, capaUrl: config.capaUrl }
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin text-[#047482]" />
        Carregando site do salão…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24">
      <h1 className="text-2xl font-bold text-gray-900">Site do salão</h1>
      <p className="mt-1 text-sm text-gray-500">
        Uma página pública com capa, cores e o que a cliente vê: agendar, cadastro, catálogo e
        endereço. Você liga e desliga cada bloco.
      </p>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {ok ? <p className="mt-3 text-sm text-emerald-700">{ok}</p> : null}

      <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">URL única</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="flex-1 break-all rounded-lg bg-[#eef4f5] px-3 py-2 text-sm text-gray-800">
            {publicData?.urls.site ? landingUrlOnCurrentOrigin(publicData.urls.site) : '—'}
          </code>
          <button
            type="button"
            onClick={() => void copiarUrl()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#047482]/30 px-3 py-2 text-sm font-medium text-[#047482]"
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={config.publicada}
            onChange={(e) => patch({ publicada: e.target.checked })}
          />
          Página no ar
        </label>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-5">
          <section>
            <h2 className="text-sm font-semibold text-gray-900">Estilo</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {LANDING_ESTILO_META.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => patch({ estilo: item.id })}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    config.estilo === item.id
                      ? 'bg-[#047482] text-white'
                      : 'border border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  {item.nome}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {LANDING_ESTILO_META.find((e) => e.id === config.estilo)?.resumo}
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Cores</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {LANDING_PALETAS.map((id) => {
                const item = LANDING_PALETA_META[id];
                const active = config.paleta === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => patch({ paleta: id })}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                      active
                        ? 'border-[#047482] bg-[#eef4f5] font-semibold text-[#047482]'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-black/10"
                      style={{ background: item.swatch }}
                    />
                    {item.nome}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Capa</h2>
            <p className="mt-1 text-xs text-gray-500">
              JPEG, PNG, WebP ou HEIC. O sistema converte para WebP leve (até 1600px).
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#047482]/30 px-3 py-2 text-sm font-medium text-[#047482]">
                <Upload className="h-4 w-4" />
                {uploading ? 'Convertendo…' : 'Enviar foto'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void onCapa(file);
                  }}
                />
              </label>
              {config.capaUrl ? (
                <button
                  type="button"
                  onClick={() => void removerCapa()}
                  className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                  Remover
                </button>
              ) : null}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Frase no topo</h2>
            <p className="mt-1 text-xs text-gray-500">
              Aparece sobre a capa. Deixe em branco para ficar só a foto.
            </p>
            <input
              type="text"
              value={config.tituloHero}
              onChange={(e) => setConfig({ ...config, tituloHero: e.target.value })}
              onBlur={(e) => void save({ ...config, tituloHero: e.target.value })}
              maxLength={80}
              placeholder="Ex.: Cílios no seu horário"
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800"
            />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Texto da dona</h2>
            <textarea
              value={config.textoExperiencia}
              onChange={(e) => setConfig({ ...config, textoExperiencia: e.target.value })}
              onBlur={() => void save(config)}
              rows={4}
              maxLength={2000}
              placeholder="Conte a experiência: ritmo do atendimento, o que a cliente sente ao chegar…"
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800"
            />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">O que aparece na página</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {BLOCO_LABELS.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={config.blocos[item.key]}
                    onChange={(e) =>
                      patch({
                        blocos: { ...config.blocos, [item.key]: e.target.checked },
                      })
                    }
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h2 className="text-sm font-semibold text-gray-900">Atalhos no mesmo menu</h2>
            <div className="mt-2 grid gap-2 text-sm">
              <Link className="text-[#047482] hover:underline" href="/dashboard/catalogo">
                Editar catálogo
              </Link>
              <Link
                className="text-[#047482] hover:underline"
                href="/dashboard/configuracoes/equipe"
              >
                Cadastro de profissionais
              </Link>
              <Link className="text-[#047482] hover:underline" href="/dashboard/configuracoes">
                Mensagens de resgate e lembretes
              </Link>
              <Link
                className="text-[#047482] hover:underline"
                href="/dashboard/configuracoes?tab=link"
              >
                Links de autoagendamento e autocadastro
              </Link>
              <Link
                className="text-[#047482] hover:underline"
                href="/dashboard/configuracoes?tab=horarios"
              >
                Horários do agendamento online
              </Link>
            </div>
          </section>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Prévia</h2>
            {saving ? <span className="text-xs text-gray-400">Salvando…</span> : null}
          </div>
          {preview ? <SalaoLandingView data={preview} preview /> : null}
        </div>
      </div>
    </div>
  );
}
