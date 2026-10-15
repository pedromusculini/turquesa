export type ServicoPrimeiroUso = {
  id: string;
  nome: string;
  duracaoMinutos: number;
  precoCentavos: number;
};

export const SERVICOS_PRIMEIRO_USO: ServicoPrimeiroUso[] = [
  { id: 'corte', nome: 'Corte', duracaoMinutos: 40, precoCentavos: 5000 },
  { id: 'escova', nome: 'Escova', duracaoMinutos: 40, precoCentavos: 6000 },
  { id: 'coloracao', nome: 'Coloração', duracaoMinutos: 90, precoCentavos: 15000 },
  { id: 'manicure', nome: 'Manicure', duracaoMinutos: 40, precoCentavos: 4000 },
  { id: 'pedicure', nome: 'Pedicure', duracaoMinutos: 50, precoCentavos: 4500 },
  { id: 'barba', nome: 'Barba', duracaoMinutos: 30, precoCentavos: 3500 },
  { id: 'sobrancelha', nome: 'Sobrancelha', duracaoMinutos: 20, precoCentavos: 3000 },
  { id: 'maquiagem', nome: 'Maquiagem', duracaoMinutos: 60, precoCentavos: 12000 },
  { id: 'cilios', nome: 'Cílios', duracaoMinutos: 120, precoCentavos: 15000 },
  { id: 'unhas_gel', nome: 'Unhas em gel', duracaoMinutos: 90, precoCentavos: 12000 },
  { id: 'depilacao', nome: 'Depilação', duracaoMinutos: 30, precoCentavos: 5000 },
  { id: 'limpeza_pele', nome: 'Limpeza de pele', duracaoMinutos: 60, precoCentavos: 12000 },
  { id: 'massagem', nome: 'Massagem', duracaoMinutos: 60, precoCentavos: 12000 },
];

export function resolveServicosPrimeiroUso(ids: string[]): ServicoPrimeiroUso[] {
  const wanted = new Set(ids.map((id) => id.trim().toLowerCase()).filter(Boolean));
  return SERVICOS_PRIMEIRO_USO.filter((s) => wanted.has(s.id));
}

/** Campo "Outro" do onboarding: nomes separados por vírgula. */
export function parseServicosExtras(texto: string): string[] {
  const vistos = new Set<string>();
  const nomes: string[] = [];
  for (const parte of texto.split(/[,;\n]/)) {
    const nome = parte.trim().slice(0, 60);
    if (!nome || vistos.has(nome.toLowerCase())) continue;
    vistos.add(nome.toLowerCase());
    nomes.push(nome);
    if (nomes.length >= 5) break;
  }
  return nomes;
}
