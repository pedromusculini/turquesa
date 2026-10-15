export function isValidAgendaTelefone(telefone: string | null | undefined): boolean {
  const digits = telefone?.replace(/\D/g, '') ?? '';
  return digits.length >= 10;
}
