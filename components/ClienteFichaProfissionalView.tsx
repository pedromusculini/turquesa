'use client';

import { useEffect, useState } from 'react';
import { Loader2, User, ClipboardList, MessageSquare, CalendarDays } from 'lucide-react';
import { formatAnamneseValor } from '@/lib/clienteFicha';
import type { AnamneseCampo } from '@/lib/anamnese';
import type { ClienteFichaPublicAtendimento } from '@/lib/loadClienteFichaPublic';

type FichaData = {
  nome_salao: string;
  cliente: {
    nome: string;
    telefone: string | null;
    email: string | null;
    observacoes_gerais: string | null;
    servico_interesse_nome: string | null;
  };
  anamnese_campos: AnamneseCampo[];
  anamnese_respostas: Record<string, string | boolean>;
  observacoes: Array<{ texto: string; autor: string | null; created_at: string }>;
  ultimos_atendimentos: ClienteFichaPublicAtendimento[];
};

function formatDataBr(iso: string): string {
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return iso;
  return `${day}/${m}/${y}`;
}

type Props = {
  token: string;
};

export default function ClienteFichaProfissionalView({ token }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ficha, setFicha] = useState<FichaData | null>(null);

  useEffect(() => {
    fetch(`/api/formulario/${token}/ficha`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setFicha(data as FichaData);
      })
      .catch(() => setError('Não foi possível carregar a ficha'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#047482]" />
      </div>
    );
  }

  if (error || !ficha) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <p className="text-red-600">{error ?? 'Ficha indisponível'}</p>
      </div>
    );
  }

  const anamnesePreenchida =
    ficha.anamnese_campos.length > 0 &&
    Object.keys(ficha.anamnese_respostas).length > 0;

  return (
    <div className="max-w-lg mx-auto p-4 py-8 sm:p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-[#047482] px-5 py-4 text-white">
          <p className="text-xs uppercase tracking-wide opacity-80">{ficha.nome_salao}</p>
          <h1 className="text-xl font-bold mt-1 flex items-center gap-2">
            <User className="w-5 h-5 shrink-0" />
            {ficha.cliente.nome}
          </h1>
          {(ficha.cliente.telefone || ficha.cliente.email) && (
            <p className="text-sm opacity-90 mt-1">
              {[ficha.cliente.telefone, ficha.cliente.email].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        <div className="p-5 space-y-5">
          {ficha.cliente.servico_interesse_nome && (
            <section>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Serviço de interesse
              </p>
              <p className="text-sm text-gray-900">{ficha.cliente.servico_interesse_nome}</p>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <ClipboardList className="w-4 h-4 text-[#047482]" />
              Anamnese
            </h2>
            {anamnesePreenchida ? (
              <ul className="space-y-2 text-sm">
                {ficha.anamnese_campos.map((campo) => {
                  const val = ficha.anamnese_respostas[campo.id];
                  if (val === undefined) return null;
                  return (
                    <li
                      key={campo.id}
                      className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100"
                    >
                      <span className="text-gray-500 block text-xs">{campo.label}</span>
                      <span className="text-gray-900">{formatAnamneseValor(campo, val)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">Anamnese ainda não preenchida.</p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-[#047482]" />
              Observações
            </h2>
            {ficha.cliente.observacoes_gerais ? (
              <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 mb-3">
                <p className="text-xs text-gray-500 mb-1">Gerais</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {ficha.cliente.observacoes_gerais}
                </p>
              </div>
            ) : null}
            {ficha.observacoes.length > 0 ? (
              <ul className="space-y-2">
                {ficha.observacoes.slice(0, 8).map((obs, i) => (
                  <li
                    key={`${obs.created_at}-${i}`}
                    className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 text-sm"
                  >
                    <p className="text-gray-800 whitespace-pre-wrap">{obs.texto}</p>
                    {obs.autor && (
                      <p className="text-xs text-gray-400 mt-1">{obs.autor}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : !ficha.cliente.observacoes_gerais ? (
              <p className="text-sm text-gray-400">Sem observações cadastradas.</p>
            ) : null}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4 text-[#047482]" />
              Últimos atendimentos
            </h2>
            {ficha.ultimos_atendimentos.length > 0 ? (
              <ul className="space-y-3">
                {ficha.ultimos_atendimentos.map((a, i) => (
                  <li
                    key={`${a.data}-${a.hora ?? ''}-${i}`}
                    className="border border-gray-100 rounded-xl p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-1">
                      <span className="font-medium text-gray-900">
                        {formatDataBr(a.data)}
                        {a.hora ? ` · ${a.hora}` : ''}
                      </span>
                      {a.medico && (
                        <span className="text-xs text-gray-500">{a.medico}</span>
                      )}
                    </div>
                    {a.servico && (
                      <p className="text-gray-700 mt-1">
                        <span className="text-gray-500">Serviço: </span>
                        {a.servico}
                      </p>
                    )}
                    {a.observacoes && (
                      <p className="text-gray-600 mt-1 whitespace-pre-wrap text-xs">
                        {a.observacoes}
                      </p>
                    )}
                    {!a.servico && !a.observacoes && (
                      <p className="text-gray-400 text-xs mt-1 capitalize">{a.status}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">Nenhum atendimento registrado ainda.</p>
            )}
          </section>
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 mt-6">
        Turquesa Agenda · Ficha do cliente (somente leitura)
      </p>
    </div>
  );
}
