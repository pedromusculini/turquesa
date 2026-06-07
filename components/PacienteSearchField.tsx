'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchableSelect from '@/components/SearchableSelect';
import type { PacienteOpcao } from '@/lib/types';
import {
  mergeOpcoesLista,
  selFromDriveId,
  telefoneFromOpcao,
  telefonePreenchido,
} from '@/lib/pacienteOpcoesUi';

type PacienteSearchFieldProps = {
  value: string;
  onChange: (sel: string, opt: PacienteOpcao | null) => void;
  /** Preenche o campo WhatsApp ao selecionar ou pré-selecionar cliente (se vazio). */
  onTelefoneChange?: (telefone: string) => void;
  /** Valor atual do WhatsApp — na pré-seleção só preenche se estiver vazio. */
  telefoneAtual?: string;
  clientesIniciais?: PacienteOpcao[];
  preselectDriveId?: string | null;
  label?: string;
  error?: string;
  manualName?: string;
  onManualNameChange?: (nome: string) => void;
  manualNameError?: string;
};

export default function PacienteSearchField({
  value,
  onChange,
  onTelefoneChange,
  telefoneAtual = '',
  clientesIniciais = [],
  preselectDriveId = null,
  label = 'Cliente *',
  error,
  manualName = '',
  onManualNameChange,
  manualNameError,
}: PacienteSearchFieldProps) {
  const [opcoes, setOpcoes] = useState<PacienteOpcao[]>(clientesIniciais);
  const [loadingOpcoes, setLoadingOpcoes] = useState(true);
  const [googleContatosOk, setGoogleContatosOk] = useState(false);
  const [driveConectado, setDriveConectado] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const appliedPreselectRef = useRef(false);

  const loadOpcoes = useCallback(async () => {
    setLoadingOpcoes(true);
    try {
      const res = await fetch('/api/clientes/pacientes-opcoes');
      const d = await res.json();
      if (res.ok) {
        setOpcoes(mergeOpcoesLista(clientesIniciais, d.opcoes || []));
        setGoogleContatosOk(!!d.google_contatos_disponivel);
        setDriveConectado(d.drive_conectado !== false);
        setAviso(d.aviso || null);
      } else {
        setAviso(d.error || 'Não foi possível carregar a lista de clientes.');
        if (clientesIniciais.length > 0) {
          setOpcoes(clientesIniciais);
        }
      }
    } catch {
      setAviso('Erro de rede ao carregar clientes.');
      if (clientesIniciais.length > 0) setOpcoes(clientesIniciais);
    } finally {
      setLoadingOpcoes(false);
    }
  }, [clientesIniciais]);

  useEffect(() => {
    setOpcoes((prev) => mergeOpcoesLista(clientesIniciais, prev));
  }, [clientesIniciais]);

  useEffect(() => {
    appliedPreselectRef.current = false;
    void loadOpcoes();
  }, [loadOpcoes]);

  const emitTelefone = useCallback(
    (opt: PacienteOpcao | null, force: boolean) => {
      if (!onTelefoneChange) return;
      const tel = telefoneFromOpcao(opt);
      if (!tel) return;
      if (!force && telefonePreenchido(telefoneAtual)) return;
      onTelefoneChange(tel);
    },
    [onTelefoneChange, telefoneAtual],
  );

  const notifySelection = useCallback(
    (sel: string, opt: PacienteOpcao | null, mode: 'select' | 'preselect') => {
      onChange(sel, opt);
      emitTelefone(opt, mode === 'select');
    },
    [onChange, emitTelefone],
  );

  useEffect(() => {
    if (!preselectDriveId || appliedPreselectRef.current) return;
    const sel = selFromDriveId(preselectDriveId);
    const opt = opcoes.find((o) => o.id === sel);
    if (opt) {
      appliedPreselectRef.current = true;
      notifySelection(sel, opt, 'preselect');
    }
  }, [preselectDriveId, opcoes, notifySelection]);

  const clienteOptions = useMemo(
    () =>
      opcoes.map((o) => ({
        value: o.id,
        label: o.nome,
        sublabel: [
          o.telefone,
          o.convenio,
          o.origem === 'google' ? 'Google Contatos' : 'Cliente',
        ]
          .filter(Boolean)
          .join(' · '),
      })),
    [opcoes],
  );

  const pacienteSelecionado = useMemo(
    () => opcoes.find((o) => o.id === value) ?? null,
    [opcoes, value],
  );

  function handleSelect(sel: string) {
    const opt = opcoes.find((o) => o.id === sel) ?? null;
    notifySelection(sel, opt, 'select');
  }

  const placeholder = loadingOpcoes
    ? 'Carregando lista...'
    : opcoes.length === 0
      ? 'Nenhum cadastro — use o nome abaixo'
      : `${opcoes.length} clientes — toque para buscar`;

  return (
    <div className="space-y-3">
      <SearchableSelect
        label={label}
        options={clienteOptions}
        value={value}
        onChange={handleSelect}
        placeholder={placeholder}
        searchPlaceholder="Nome, telefone ou e-mail..."
        disabled={false}
        error={error}
        dropdownMode="fixed"
        listMaxHeight="max-h-80"
        emptyMessage={
          loadingOpcoes
            ? 'Carregando...'
            : 'Nenhum resultado. Digite o nome abaixo ou conecte o Google no Dashboard.'
        }
      />

      {aviso && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{aviso}</p>
      )}

      {googleContatosOk && (
        <p className="text-xs text-[#047482]">
          Contatos Google na lista — telefone e dados preenchem ao selecionar.
        </p>
      )}
      {!googleContatosOk && !loadingOpcoes && driveConectado && (
        <p className="text-xs text-gray-500">
          Conecte os Contatos Google no Dashboard para incluir contatos da agenda Google.
        </p>
      )}

      {pacienteSelecionado && (
        <div className="rounded-xl border border-[#3795a1]/50 bg-[#F8FAFC] px-4 py-3 text-sm space-y-1">
          <p className="font-semibold text-gray-900">{pacienteSelecionado.nome}</p>
          {pacienteSelecionado.telefone && (
            <p className="text-gray-600">
              WhatsApp:{' '}
              <span className="font-medium">{pacienteSelecionado.telefone}</span>
            </p>
          )}
          {pacienteSelecionado.convenio && (
            <p className="text-gray-600">Convênio: {pacienteSelecionado.convenio}</p>
          )}
          {pacienteSelecionado.email && (
            <p className="text-gray-600 truncate">E-mail: {pacienteSelecionado.email}</p>
          )}
          <p className="text-xs text-gray-400 pt-0.5">
            {pacienteSelecionado.origem === 'google'
              ? 'Será cadastrado automaticamente ao salvar, se ainda não existir.'
              : 'Cliente cadastrado'}
          </p>
        </div>
      )}

      {onManualNameChange && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {value ? 'Nome (ajuste se necessário)' : 'Nome do cliente *'}
          </label>
          <input
            type="text"
            value={manualName}
            onChange={(e) => onManualNameChange(e.target.value)}
            placeholder="Ex: Maria Silva"
            className={`w-full rounded-xl border px-3 py-2.5 text-sm ${
              manualNameError ? 'border-red-400 bg-red-50' : 'border-gray-200'
            }`}
          />
          {manualNameError && (
            <p className="text-xs text-red-600 mt-1">{manualNameError}</p>
          )}
          {!value && (
            <p className="text-xs text-gray-500 mt-1">
              Se não achar na lista, digite o nome — ao salvar criamos o cadastro no Drive.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
