'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  LEADS_CWB,
  buildMensagemCwb,
  isCelular41,
  whatsappUrl,
  type LeadCwb,
} from '@/lib/leadsGuerrilhaCwb';

const STORAGE_KEY = 'turquesa-guerrilha-cwb-v1';

type StatusMap = Record<string, 'pendente' | 'enviado' | 'respondeu' | 'pular'>;

function loadStatus(): StatusMap {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as StatusMap;
  } catch {
    return {};
  }
}

function saveStatus(map: StatusMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export default function GuerrilhaCwbClient() {
  const [status, setStatus] = useState<StatusMap>({});
  const [filtro, setFiltro] = useState<'todos' | 'pendente' | 'enviado' | 'celular'>('pendente');
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState<LeadCwb | null>(null);
  const [msgEdit, setMsgEdit] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStatus(loadStatus());
    setReady(true);
  }, []);

  const counts = useMemo(() => {
    let pendente = 0;
    let enviado = 0;
    for (const l of LEADS_CWB) {
      const s = status[l.id] || 'pendente';
      if (s === 'enviado' || s === 'respondeu') enviado += 1;
      else if (s !== 'pular') pendente += 1;
    }
    return { pendente, enviado, total: LEADS_CWB.length };
  }, [status]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return LEADS_CWB.filter((l) => {
      const s = status[l.id] || 'pendente';
      if (filtro === 'pendente' && (s === 'enviado' || s === 'respondeu' || s === 'pular'))
        return false;
      if (filtro === 'enviado' && s !== 'enviado' && s !== 'respondeu') return false;
      if (filtro === 'celular' && !isCelular41(l.telefone)) return false;
      if (!q) return true;
      return (
        l.nome.toLowerCase().includes(q) ||
        l.bairro.toLowerCase().includes(q) ||
        l.cidade.toLowerCase().includes(q)
      );
    }).sort((a, b) => {
      const ca = isCelular41(a.telefone) ? 0 : 1;
      const cb = isCelular41(b.telefone) ? 0 : 1;
      return ca - cb || a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [filtro, busca, status]);

  function setLeadStatus(id: string, value: StatusMap[string]) {
    setStatus((prev) => {
      const next = { ...prev, [id]: value };
      saveStatus(next);
      return next;
    });
  }

  function abrirLead(lead: LeadCwb) {
    setAtivo(lead);
    setMsgEdit(buildMensagemCwb(lead));
  }

  async function copiarMensagem() {
    if (!msgEdit) return;
    try {
      await navigator.clipboard.writeText(msgEdit);
      alert('Mensagem copiada');
    } catch {
      alert('Não deu pra copiar — selecione o texto manualmente');
    }
  }

  if (!ready) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        Carregando…
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'linear-gradient(165deg, #e8f4f5 0%, #F8FAFC 40%, #f3efe8 100%)',
        color: '#0f172a',
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        padding: '12px 12px 96px',
        maxWidth: 560,
        margin: '0 auto',
      }}
    >
      <header style={{ marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: '0.06em', color: '#047482' }}>
          TURQUESA · GUERRILHA
        </p>
        <h1 style={{ margin: '4px 0 8px', fontSize: 22, color: '#047482' }}>
          Curitiba — WhatsApp
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#475569' }}>
          {counts.enviado} enviados · {counts.pendente} pendentes · {counts.total} total
        </p>
        <div
          style={{
            marginTop: 10,
            height: 8,
            borderRadius: 99,
            background: '#dbe7ea',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.round((counts.enviado / Math.max(counts.total, 1)) * 100)}%`,
              height: '100%',
              background: '#047482',
            }}
          />
        </div>
      </header>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {(
          [
            ['pendente', 'Pendentes'],
            ['celular', 'Celular 41'],
            ['enviado', 'Enviados'],
            ['todos', 'Todos'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFiltro(k)}
            style={{
              border: 'none',
              borderRadius: 999,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              background: filtro === k ? '#047482' : '#fff',
              color: filtro === k ? '#fff' : '#047482',
              boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar nome, bairro…"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          border: '1px solid #c5d5d8',
          borderRadius: 12,
          padding: '12px 14px',
          fontSize: 16,
          marginBottom: 12,
          background: '#fff',
        }}
      />

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {lista.map((lead) => {
          const s = status[lead.id] || 'pendente';
          return (
            <li key={lead.id}>
              <button
                type="button"
                onClick={() => abrirLead(lead)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: '1px solid #d5e2e5',
                  borderRadius: 14,
                  padding: 14,
                  background: s === 'enviado' || s === 'respondeu' ? '#f1f5f9' : '#fff',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong style={{ fontSize: 16 }}>{lead.nome}</strong>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: isCelular41(lead.telefone) ? '#047482' : '#94a3b8',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isCelular41(lead.telefone) ? 'CEL' : 'FIXO'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  {[lead.bairro, lead.cidade].filter(Boolean).join(' · ')}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                  {s === 'pendente' ? 'Pendente' : s}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {lista.length === 0 && (
        <p style={{ textAlign: 'center', color: '#64748b', marginTop: 32 }}>
          Nenhum lead neste filtro.
        </p>
      )}

      {ativo && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 50,
            padding: 12,
          }}
          onClick={() => setAtivo(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 560,
              maxHeight: '92dvh',
              overflow: 'auto',
              background: '#fff',
              borderRadius: 18,
              padding: 16,
              boxShadow: '0 20px 40px rgba(15,23,42,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: '#047482' }}>{ativo.nome}</h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                  {[ativo.bairro, ativo.cidade].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAtivo(null)}
                style={{
                  border: 'none',
                  background: '#f1f5f9',
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontWeight: 600,
                }}
              >
                Fechar
              </button>
            </div>

            {ativo.endereco && (
              <p style={{ fontSize: 13, color: '#475569', marginTop: 10 }}>{ativo.endereco}</p>
            )}

            <label style={{ display: 'block', marginTop: 12, fontSize: 12, fontWeight: 700 }}>
              Mensagem (pode editar)
            </label>
            <textarea
              value={msgEdit}
              onChange={(e) => setMsgEdit(e.target.value)}
              rows={12}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 6,
                borderRadius: 12,
                border: '1px solid #c5d5d8',
                padding: 12,
                fontSize: 14,
                lineHeight: 1.45,
                resize: 'vertical',
              }}
            />

            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              <a
                href={whatsappUrl(ativo, msgEdit)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setLeadStatus(ativo.id, 'enviado')}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  textDecoration: 'none',
                  background: '#25D366',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 17,
                  padding: '16px 14px',
                  borderRadius: 14,
                }}
              >
                Abrir WhatsApp e enviar
              </a>
              <button
                type="button"
                onClick={copiarMensagem}
                style={{
                  border: '1px solid #c5d5d8',
                  background: '#fff',
                  borderRadius: 12,
                  padding: '12px 14px',
                  fontWeight: 600,
                }}
              >
                Copiar mensagem
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setLeadStatus(ativo.id, 'respondeu');
                    setAtivo(null);
                  }}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: '#ecfdf5',
                    color: '#047857',
                    borderRadius: 12,
                    padding: 12,
                    fontWeight: 600,
                  }}
                >
                  Respondeu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLeadStatus(ativo.id, 'pular');
                    setAtivo(null);
                  }}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: '#f8fafc',
                    color: '#64748b',
                    borderRadius: 12,
                    padding: 12,
                    fontWeight: 600,
                  }}
                >
                  Pular
                </button>
              </div>
              {ativo.instagram && (
                <a
                  href={ativo.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    textAlign: 'center',
                    fontSize: 14,
                    color: '#3795a1',
                    padding: 8,
                  }}
                >
                  Abrir Instagram / site
                </a>
              )}
              {ativo.email && (
                <a
                  href={`mailto:${ativo.email}?subject=${encodeURIComponent('Turquesa Agenda — 30 dias grátis')}&body=${encodeURIComponent(msgEdit)}`}
                  style={{
                    textAlign: 'center',
                    fontSize: 14,
                    color: '#3795a1',
                    padding: 8,
                  }}
                >
                  Abrir e-mail
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* botão flutuante próximo pendente */}
      {!ativo && lista[0] && (
        <div
          style={{
            position: 'fixed',
            left: 12,
            right: 12,
            bottom: 16,
            maxWidth: 560,
            margin: '0 auto',
          }}
        >
          <button
            type="button"
            onClick={() => abrirLead(lista[0])}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 14,
              padding: '16px 14px',
              background: '#047482',
              color: '#fff',
              fontWeight: 700,
              fontSize: 16,
              boxShadow: '0 8px 24px rgba(4,116,130,0.35)',
            }}
          >
            Próximo: {lista[0].nome}
          </button>
        </div>
      )}
    </main>
  );
}
