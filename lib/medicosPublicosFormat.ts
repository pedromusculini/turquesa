/** Partes puras da lista pública de profissionais — seguras para o navegador. */

export type MedicoPublico = {
  id: string | null;
  nome: string;
  crm: string | null;
  specialty: string | null;
  agenda_conectada: boolean;
};

export type MedicosPublicosResult = {
  isClinica: boolean;
  medicos: MedicoPublico[];
};

export function normNomeMedico(n: string) {
  return n.trim().toLowerCase();
}

export function findMedicoPublico(
  medicos: MedicoPublico[],
  nome: string,
): MedicoPublico | undefined {
  const n = normNomeMedico(nome);
  return medicos.find((m) => normNomeMedico(m.nome) === n);
}

export function medicoPublicoSubtitle(m: MedicoPublico): string {
  const parts: string[] = [];
  if (m.crm) parts.push(m.crm);
  if (m.specialty) parts.push(m.specialty);
  return parts.join(' · ');
}

export function medicosPublicosAgendaveis(medicos: MedicoPublico[]): MedicoPublico[] {
  return medicos.filter((m) => m.agenda_conectada);
}

export function defaultMedicoPublicoNome(medicos: MedicoPublico[]): string {
  const bookable = medicosPublicosAgendaveis(medicos);
  return bookable.length === 1 ? bookable[0].nome : '';
}

export function needsMedicoPublicoChoice(medicos: MedicoPublico[]): boolean {
  return medicosPublicosAgendaveis(medicos).length > 1;
}

export function validateMedicoPublico(
  result: MedicosPublicosResult,
  nomeSelecionado: string,
  options?: { requireAgenda?: boolean },
): string | undefined {
  const requireAgenda = options?.requireAgenda ?? false;
  const bookable = medicosPublicosAgendaveis(result.medicos);

  if (result.isClinica && result.medicos.length === 0) {
    return 'Nenhum profissional disponível. Entre em contato com o salão.';
  }
  if (requireAgenda && bookable.length === 0) {
    return 'Nenhum profissional com agenda conectada. Entre em contato com o salão.';
  }
  const escolhaObrigatoria = requireAgenda
    ? bookable.length > 1
    : result.medicos.length > 1;
  if (escolhaObrigatoria && !nomeSelecionado.trim()) {
    return 'Selecione o profissional';
  }
  const nome = nomeSelecionado.trim() || defaultMedicoPublicoNome(result.medicos);
  const chosen = findMedicoPublico(result.medicos, nome);
  if (nome && !chosen) {
    return 'Profissional inválido';
  }
  if (requireAgenda && chosen && !chosen.agenda_conectada) {
    return 'Profissional sem agenda conectada';
  }
  return undefined;
}

export function resolveMedicoPublicoPayload(
  result: MedicosPublicosResult,
  nomeSelecionado: string,
): { medico: string; medico_crm: string | null; medico_especialidade: string | null } | null {
  const nome = nomeSelecionado.trim() || defaultMedicoPublicoNome(result.medicos);
  if (!nome) return null;
  const m = findMedicoPublico(result.medicos, nome);
  return {
    medico: nome,
    medico_crm: m?.crm ?? null,
    medico_especialidade: m?.specialty ?? null,
  };
}
