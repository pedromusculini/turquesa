'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2, MessageCircle } from 'lucide-react';

type PublicLinksState = {
  link_formulario: string | null;
  link_catalogo: string | null;
  mensagem_whatsapp?: string;
  mensagem_whatsapp_catalogo?: string;
};

type Props = {
  /** Fundo claro (configurações) ou escuro (card do dashboard). */
  variant?: 'light' | 'dark';
  className?: string;
};

export default function PublicClientLinksSection({
  variant = 'light',
  className = '',
}: Props) {
  const [data, setData] = useState<PublicLinksState>({
    link_formulario: null,
    link_catalogo: null,
  });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/formulario/autocadastro');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar');
      setData({
        link_formulario: json.link_formulario ?? json.link ?? null,
        link_catalogo: json.link_catalogo ?? null,
        mensagem_whatsapp: json.mensagem_whatsapp,
        mensagem_whatsapp_catalogo: json.mensagem_whatsapp_catalogo,
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

  async function copiar(texto: string, key: string) {
    await navigator.clipboard.writeText(texto);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const dark = variant === 'dark';
  const box = dark
    ? 'bg-white/10 text-green-100'
    : 'bg-[#eef4f5] border border-[#3795a1]/40 text-gray-800';
  const label = dark ? 'text-green-200' : 'text-gray-600';
  const mono = dark
    ? 'font-mono text-sm break-all bg-black/20 rounded-lg p-3 text-white'
    : 'font-mono text-sm break-all bg-white rounded-lg p-3 border border-gray-100';
  const btn = dark
    ? 'text-sm bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg inline-flex items-center gap-1.5'
    : 'text-sm border border-[#047482]/30 text-[#047482] hover:bg-[#eef4f5] px-3 py-2 rounded-lg inline-flex items-center gap-1.5';

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm ${dark ? 'text-green-100' : 'text-gray-500'} ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando links...
      </div>
    );
  }

  if (!data.link_formulario) {
    return (
      <p className={`text-sm ${dark ? 'text-green-200' : 'text-gray-500'} ${className}`}>
        Crie um link de cadastro no Dashboard para gerar os links públicos de formulário e catálogo.
      </p>
    );
  }

  const links: { key: string; titulo: string; url: string; msg?: string }[] = [
    {
      key: 'form',
      titulo: 'Link cadastro de cliente',
      url: data.link_formulario,
      msg: data.mensagem_whatsapp,
    },
  ];
  if (data.link_catalogo) {
    links.push({
      key: 'catalogo',
      titulo: 'Link catálogo de serviços',
      url: data.link_catalogo,
      msg: data.mensagem_whatsapp_catalogo,
    });
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {links.map((item) => (
        <div key={item.key} className={`rounded-xl p-4 ${box}`}>
          <p className={`text-xs font-medium uppercase tracking-wide mb-2 ${label}`}>
            {item.titulo}
          </p>
          <p className={mono}>{item.url}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => copiar(item.url, item.key)} className={btn}>
              <Copy className="w-4 h-4" />
              {copied === item.key ? 'Copiado!' : 'Copiar link'}
            </button>
            {item.msg && (
              <button
                type="button"
                onClick={() => copiar(item.msg!, `${item.key}-msg`)}
                className={btn}
              >
                <Copy className="w-4 h-4" />
                {copied === `${item.key}-msg` ? 'Copiado!' : 'Copiar mensagem WhatsApp'}
              </button>
            )}
            {item.msg && (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(item.msg)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium ${
                  dark ? 'bg-[#25D366] hover:bg-[#20bd5a] text-white' : 'bg-[#25D366] text-white hover:bg-[#20bd5a]'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </a>
            )}
          </div>
        </div>
      ))}
      <p className={`text-xs leading-relaxed ${dark ? 'text-green-200/80' : 'text-gray-500'}`}>
        O mesmo token vale nos dois endereços: cadastro em{' '}
        <code className={dark ? 'text-white/90' : 'text-gray-700'}>/f/…</code> e vitrine em{' '}
        <code className={dark ? 'text-white/90' : 'text-gray-700'}>/c/…</code>. Regenerar o link no
        Dashboard invalida o anterior.
      </p>
      {error && (
        <p className={`text-sm ${dark ? 'text-red-200' : 'text-red-600'}`}>{error}</p>
      )}
    </div>
  );
}
