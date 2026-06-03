'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Link2,
  Copy,
  MessageCircle,
  RefreshCw,
  Loader2,
  UserPlus,
  Sparkles,
} from 'lucide-react';

type AutocadastroState = {
  link: string | null;
  mensagem_whatsapp?: string;
  pendentes: number;
};

export default function AutocadastroLinkCard() {
  const [data, setData] = useState<AutocadastroState>({ link: null, pendentes: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState<'link' | 'msg' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/formulario/autocadastro');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar');
      setData({
        link: json.link ?? null,
        mensagem_whatsapp: json.mensagem_whatsapp,
        pendentes: json.pendentes ?? 0,
      });
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function gerarLink() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/formulario/autocadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao gerar link');
      setData({
        link: json.link,
        mensagem_whatsapp: json.mensagem_whatsapp,
        pendentes: 0,
      });
      if (json.link) await navigator.clipboard.writeText(json.link);
      setCopied('link');
      setTimeout(() => setCopied(null), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setGenerating(false);
    }
  }

  async function sincronizar() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/clientes/sync-formularios', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === 'DRIVE_NOT_CONNECTED') {
          throw new Error(
            'Conecte o Google Drive no card "Google — conectar e sincronizar" no topo do Dashboard.',
          );
        }
        throw new Error(json.error || 'Erro ao sincronizar');
      }
      await load();
      if (json.sincronizados > 0) {
        alert(
          `${json.sincronizados} paciente(s) importado(s) com sucesso. Veja em Clientes.`,
        );
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSyncing(false);
    }
  }

  async function copiar(texto: string, tipo: 'link' | 'msg') {
    await navigator.clipboard.writeText(texto);
    setCopied(tipo);
    setTimeout(() => setCopied(null), 2000);
  }

  const whatsappUrl = data.mensagem_whatsapp
    ? `https://wa.me/?text=${encodeURIComponent(data.mensagem_whatsapp)}`
    : null;

  return (
    <div className="bg-gradient-to-br from-[#013a01] to-[#025201] rounded-2xl p-6 text-white shadow-lg mb-8">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="w-6 h-6" />
            <h2 className="text-xl font-bold">Link para o paciente se cadastrar</h2>
          </div>
          <p className="text-green-100 text-sm max-w-xl leading-relaxed">
            Crie um link e envie por WhatsApp ou e-mail. O paciente preenche os dados sozinho — você
            não precisa cadastrá-lo manualmente antes. Depois, importe tudo para a sua lista de
            Clientes (fica salvo no seu Google Drive).
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs bg-white/15 rounded-full px-3 py-1">
            <Sparkles className="w-3.5 h-3.5" />
            Para marcar consulta, use o link em Configurações no Dashboard
          </div>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={gerarLink}
            disabled={generating || loading}
            className="inline-flex items-center gap-2 bg-white text-[#013a01] px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-50 disabled:opacity-60"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
            {data.link ? 'Criar outro link' : 'Criar link de cadastro'}
          </button>
          {data.pendentes > 0 && (
            <button
              type="button"
              onClick={sincronizar}
              disabled={syncing}
              className="inline-flex items-center gap-2 border border-white/40 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              Importar cadastros ({data.pendentes})
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-green-100 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando...
        </div>
      ) : data.link ? (
        <div className="mt-6 bg-white/10 rounded-xl p-4 space-y-3">
          <p className="text-xs text-green-200 font-medium uppercase tracking-wide">
            Link para enviar ao paciente
          </p>
          <p className="text-sm break-all font-mono bg-black/20 rounded-lg p-3">{data.link}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copiar(data.link!, 'link')}
              className="inline-flex items-center gap-1.5 text-sm bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg"
            >
              <Copy className="w-4 h-4" />
              {copied === 'link' ? 'Copiado!' : 'Copiar link'}
            </button>
            {data.mensagem_whatsapp && (
              <button
                type="button"
                onClick={() => copiar(data.mensagem_whatsapp!, 'msg')}
                className="inline-flex items-center gap-1.5 text-sm bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg"
              >
                <Copy className="w-4 h-4" />
                {copied === 'msg' ? 'Copiado!' : 'Copiar mensagem'}
              </button>
            )}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm bg-[#25D366] hover:bg-[#20bd5a] px-3 py-2 rounded-lg font-medium"
              >
                <MessageCircle className="w-4 h-4" />
                Compartilhar no WhatsApp
              </a>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-green-200">
          Você ainda não tem um link. Toque em &quot;Criar link de cadastro&quot; para começar.
        </p>
      )}

      {error && (
        <p className="mt-4 text-sm bg-red-500/20 border border-red-300/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <p className="mt-4 text-xs text-green-200/80 leading-relaxed">
        Após importar, os pacientes aparecem em{' '}
        <Link href="/clientes" className="underline font-medium text-white">
          Clientes
        </Link>
        . Para isso, o Google Drive precisa estar conectado (menu Backup ou Clientes).
      </p>
    </div>
  );
}
