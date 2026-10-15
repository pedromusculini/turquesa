export function isEnderecoPerfilCompleto(profile: Record<string, unknown>): boolean {
  const street = String(profile.street ?? '').trim();
  const city = String(profile.city ?? '').trim();
  const legacy = String(profile.address ?? '').trim();
  if (street && city) return true;
  return legacy.length >= 8;
}
