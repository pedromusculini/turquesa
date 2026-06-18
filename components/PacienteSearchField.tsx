'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchableSelect from '@/components/SearchableSelect';
import type { PacienteOpcao } from '@/lib/types';
import { clienteMatchesQuery } from '@/lib/clienteSearch';
import {
  fetchTelefoneClienteDrive,
  findTelefoneGooglePorNome,
  labelClienteComAtendimentos,
  mergeOpcoesLista,
  selFromDriveId,
  telefoneFromOpcao,
  telefonePreenchido,
  fetchPacienteOpcaoByDriveId,
} from '@/lib/pacienteOpcoesUi';
import { fetchPacientesOpcoes } from '@/lib/pacientesOpcoesClient';

type PacienteSearchFieldProps = {
  value: string;
  onChange: (sel: string, opt: PacienteOpcao | null) => void;
  /** Preenche o campo WhatsApp ao selecionar ou pré-selecionar cliente (se vazio). */
  onTelefoneChange?: (telefone: string) => void;
  /** Valor atual do WhatsApp — na pré-seleção só preenche se estiver vazio. */
  telefoneAtual?: string;
  /** Usuário editou o WhatsApp manualmente — não sobrescrever ao recarregar opções. */
  telefoneEditadoPeloUsuario?: boolean;
  clientesIniciais?: PacienteOpcao[];
  preselectDriveId?: string | null;
  label?: string;
  error?: string;
  manualName?: string;
  onManualNameChange?: (nome: string) => void;
  manualNameError?: string;
  /** Permite selecionar contatos Google (`g:`). Padrão false — agenda e atendimento só aceitam cadastrados. */
  allowGoogleSelection?: boolean;
};

export default function PacienteSearchField({
  value,
  onChange,
  onTelefoneChange,
  telefoneAtual = '',
  telefoneEditadoPeloUsuario = false,
  clientesIniciais = [],
  preselectDriveId = null,
  label = 'Cliente *',
  error,
  manualName = '',
  onManualNameChange,
  manualNameError,
  allowGoogleSelection = false,
}: PacienteSearchFieldProps) {
  const [opcoes, setOpcoes] = useState<PacienteOpcao[]>(clientesIniciais);
  const [loadingOpcoes, setLoadingOpcoes] = useState(() => clientesIniciais.length === 0);
  const [googleContatosOk, setGoogleContatosOk] = useState(false);
  const [driveConectado, setDriveConectado] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const appliedPreselectRef = useRef(false);
  /** Seleção manual — força sync do WhatsApp mesmo com telefone já preenchido. */
  const manualSelectValueRef = useRef<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientesIniciaisRef = useRef(clientesIniciais);
  clientesIniciaisRef.current = clientesIniciais;

  const opcoesSelecionaveis = useMemo(() => {
    if (allowGoogleSelection) return opcoes;
    return opcoes.filter((o) => o.origem === 'drive' || o.id.startsWith('d:'));
  }, [opcoes, allowGoogleSelection]);

  const revalidateOpcoes = useCallback(
    async (opts?: { showLoading?: boolean }) => {
      const iniciais = clientesIniciaisRef.current;
      if (opts?.showLoading) setLoadingOpcoes(true);
      try {
        const d = await fetchPacientesOpcoes({ includeGoogle: allowGoogleSelection });
        setOpcoes(mergeOpcoesLista(iniciais, d.opcoes));
        setGoogleContatosOk(d.google_contatos_disponivel);
        setDriveConectado(d.drive_conectado);
        setAviso(d.aviso);
      } catch (e) {
        setAviso(
          e instanceof Error ? e.message : 'Erro de rede ao carregar clientes.',
        );
        if (iniciais.length > 0) {
          setOpcoes((prev) => mergeOpcoesLista(iniciais, prev));
        }
      } finally {
        setLoadingOpcoes(false);
      }
    },
    [allowGoogleSelection],
  );

  useEffect(() => {
    if (clientesIniciais.length === 0) return;
    setOpcoes((prev) => mergeOpcoesLista(clientesIniciais, prev));
    setLoadingOpcoes(false);
  }, [clientesIniciais]);

  useEffect(() => {
    appliedPreselectRef.current = false;
  }, [preselectDriveId]);

  useEffect(() => {
    let cancelled = false;
    const hasIniciais = clientesIniciaisRef.current.length > 0;

    const run = () => {
      if (!cancelled) void revalidateOpcoes({ showLoading: !hasIniciais });
    };

    if (hasIniciais) {
      const id = setTimeout(run, 1200);
      return () => {
        cancelled = true;
        clearTimeout(id);
      };
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [revalidateOpcoes]);

  // Limpa seleção Google se o contexto não permite.
  useEffect(() => {
    if (allowGoogleSelection || !value.startsWith('g:')) return;
    onChange('', null);
  }, [allowGoogleSelection, value, onChange]);

  const applyTelefoneToOpcao = useCallback((sel: string, tel: string, sugerido = false) => {
    if (!tel) return;
    onTelefoneChange?.(tel);
    setOpcoes((prev) =>
      prev.map((o) =>
        o.id === sel
          ? {
              ...o,
              telefone: tel,
              ...(sugerido ? { telefoneSugerido: tel } : {}),
            }
          : o,
      ),
    );
  }, [onTelefoneChange]);

  const fillTelefoneFromSelection = useCallback(
    (sel: string, opt: PacienteOpcao | null, force: boolean, lista: PacienteOpcao[]) => {
      if (!onTelefoneChange) return;
      if (telefoneEditadoPeloUsuario && !force) return;
      const tel = telefoneFromOpcao(opt);
      if (tel) {
        if (!force && telefonePreenchido(telefoneAtual)) return;
        onTelefoneChange(tel);
        return;
      }
      if (!sel.startsWith('d:')) return;
      if (!force && telefonePreenchido(telefoneAtual)) return;

      const googleTel = findTelefoneGooglePorNome(opt?.nome, lista);
      if (googleTel) {
        applyTelefoneToOpcao(sel, googleTel, true);
        return;
      }

      void fetchTelefoneClienteDrive(sel).then((fetched) => {
        if (!fetched) return;
        if (telefoneEditadoPeloUsuario && !force) return;
        applyTelefoneToOpcao(sel, fetched);
      });
    },
    [onTelefoneChange, telefoneAtual, telefoneEditadoPeloUsuario, applyTelefoneToOpcao],
  );

  const notifySelection = useCallback(
    (sel: string, opt: PacienteOpcao | null, mode: 'select' | 'preselect', lista: PacienteOpcao[]) => {
      onChange(sel, opt);
      fillTelefoneFromSelection(sel, opt, mode === 'select', lista);
    },
    [onChange, fillTelefoneFromSelection],
  );

  useEffect(() => {
    if (!preselectDriveId || appliedPreselectRef.current) return;
    const sel = selFromDriveId(preselectDriveId);
    if (value && value !== sel) {
      appliedPreselectRef.current = true;
      return;
    }
    const opt = opcoesSelecionaveis.find((o) => o.id === sel);
    if (opt) {
      appliedPreselectRef.current = true;
      notifySelection(sel, opt, 'preselect', opcoes);
      return;
    }

    if (loadingOpcoes) return;

    const driveId = preselectDriveId.replace(/^d:/, '').trim();
    if (!driveId) return;

    let cancelled = false;
    void fetchPacienteOpcaoByDriveId(driveId).then((fetched) => {
      if (!fetched || cancelled || appliedPreselectRef.current) return;
      setOpcoes((prev) => {
        const merged = mergeOpcoesLista(prev, [fetched]);
        appliedPreselectRef.current = true;
        notifySelection(fetched.id, fetched, 'preselect', merged);
        return merged;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    preselectDriveId,
    opcoesSelecionaveis,
    opcoes,
    notifySelection,
    value,
    loadingOpcoes,
  ]);

  // Preenche WhatsApp quando a lista carrega após seleção (ex.: clientesIniciais sem telefone).
  useEffect(() => {
    if (!value || !onTelefoneChange || telefoneEditadoPeloUsuario) return;
    const opt = opcoes.find((o) => o.id === value);
    if (!opt) return;
    const force = manualSelectValueRef.current === value;
    fillTelefoneFromSelection(value, opt, force, opcoes);
  }, [value, opcoes, onTelefoneChange, telefoneEditadoPeloUsuario, fillTelefoneFromSelection]);

  const clienteOptions = useMemo(
    () =>
      opcoesSelecionaveis.map((o) => {
        const semTelDrive =
          o.origem === 'drive' &&
          !telefonePreenchido(o.telefone) &&
          !telefonePreenchido(o.telefoneSugerido);
        const hintGoogle =
          o.telefoneSugerido && o.origem === 'drive'
            ? 'WhatsApp via Google Contatos'
            : semTelDrive && googleContatosOk
              ? 'Sem WhatsApp no cadastro — busque nos Contatos Google'
              : null;
        return {
          value: o.id,
          label: labelClienteComAtendimentos(o.nome, o.atendimentos, o.origem),
          sublabel: [
            o.telefone || o.telefoneSugerido,
            o.convenio,
            hintGoogle,
            o.origem === 'google'
              ? 'Google Contatos'
              : o.origem === 'drive'
                ? 'Cliente cadastrado'
                : null,
          ]
            .filter(Boolean)
            .join(' · '),
        };
      }),
    [opcoesSelecionaveis, googleContatosOk],
  );

  const pacienteSelecionado = useMemo(
    () => opcoes.find((o) => o.id === value) ?? null,
    [opcoes, value],
  );

  function handleSelect(sel: string) {
    if (!allowGoogleSelection && sel.startsWith('g:')) return;
    const opt = opcoes.find((o) => o.id === sel) ?? null;
    manualSelectValueRef.current = sel || null;
    appliedPreselectRef.current = true;
    onChange(sel, opt);
    // Preenchimento síncrono — não depende de efeitos nem do SearchableSelect.
    fillTelefoneFromSelection(sel, opt, true, opcoes);
  }

  const placeholder = loadingOpcoes
    ? 'Carregando lista...'
    : opcoesSelecionaveis.length === 0
      ? 'Nenhum cadastro — use o nome abaixo'
      : `${opcoesSelecionaveis.length} clientes — toque para buscar`;

  const matchesQuery = useCallback(
    (label: string, sublabel: string | undefined, query: string) =>
      clienteMatchesQuery(`${label} ${sublabel ?? ''}`, query),
    [],
  );

  const handleQueryChange = useCallback(
    (q: string) => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      const trimmed = q.trim();
      if (trimmed.length < 1) return;
      searchDebounceRef.current = setTimeout(() => {
        searchDebounceRef.current = null;
        void fetchPacientesOpcoes({ q: trimmed, includeGoogle: allowGoogleSelection })
          .then((d) => {
            setOpcoes((prev) =>
              mergeOpcoesLista(clientesIniciaisRef.current, mergeOpcoesLista(prev, d.opcoes)),
            );
          })
          .catch(() => {});
      }, 280);
    },
    [allowGoogleSelection],
  );

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

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
        matchesQuery={matchesQuery}
        onQueryChange={handleQueryChange}
        largeListThreshold={50}
        maxVisibleOptions={80}
        emptyMessage={
          loadingOpcoes
            ? 'Carregando...'
            : 'Nenhum resultado. Digite o nome abaixo ou cadastre o cliente em Clientes.'
        }
      />

      {aviso && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{aviso}</p>
      )}

      {googleContatosOk && !allowGoogleSelection && (
        <p className="text-xs text-gray-500">
          Contatos Google servem como referência na página Clientes. Para agendar, selecione um
          cliente cadastrado ou digite o nome abaixo.
        </p>
      )}
      {!googleContatosOk && !loadingOpcoes && driveConectado && (
        <p className="text-xs text-gray-500">
          Conecte os Contatos Google no Dashboard para sugerir WhatsApp de clientes sem telefone.
        </p>
      )}

      {pacienteSelecionado && (
        <div className="rounded-xl border border-[#3795a1]/50 bg-[#F8FAFC] px-4 py-3 text-sm space-y-1">
          <p className="font-semibold text-gray-900">
            {labelClienteComAtendimentos(
              pacienteSelecionado.nome,
              pacienteSelecionado.atendimentos,
              pacienteSelecionado.origem,
            )}
          </p>
          {(pacienteSelecionado.telefone || pacienteSelecionado.telefoneSugerido) && (
            <p className="text-gray-600">
              WhatsApp:{' '}
              <span className="font-medium">
                {pacienteSelecionado.telefone || pacienteSelecionado.telefoneSugerido}
              </span>
              {pacienteSelecionado.telefoneSugerido &&
                !telefonePreenchido(pacienteSelecionado.telefone) && (
                  <span className="text-xs text-[#047482] ml-1">(Google Contatos)</span>
                )}
            </p>
          )}
          {pacienteSelecionado.origem === 'drive' &&
            !telefonePreenchido(pacienteSelecionado.telefone) &&
            !telefonePreenchido(pacienteSelecionado.telefoneSugerido) &&
            googleContatosOk && (
              <p className="text-xs text-amber-700">
                Sem WhatsApp no cadastro — busque nos Contatos Google ou digite manualmente.
              </p>
            )}
          {pacienteSelecionado.convenio && (
            <p className="text-gray-600">Convênio: {pacienteSelecionado.convenio}</p>
          )}
          {pacienteSelecionado.email && (
            <p className="text-gray-600 truncate">E-mail: {pacienteSelecionado.email}</p>
          )}
          {pacienteSelecionado.origem === 'google' ? (
            <p className="text-[10px] text-[#047482] pt-0.5">Google Contatos</p>
          ) : (
            <p className="text-xs text-gray-400 pt-0.5">Cliente cadastrado</p>
          )}
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
