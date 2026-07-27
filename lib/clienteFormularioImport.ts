/** Janela de destaque “Nova” após importação via formulário online. */
export const FORMULARIO_IMPORT_HIGHLIGHT_MS = 48 * 60 * 60 * 1000;

/** Cliente importada via formulário nas últimas 48h (destaque na lista). */
export function isFormularioImportRecente(
  cliente: { formulario_importado_em?: string | null },
  nowMs = Date.now(),
): boolean {
  const raw = cliente.formulario_importado_em?.trim();
  if (!raw) return false;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return false;
  return nowMs - t >= 0 && nowMs - t <= FORMULARIO_IMPORT_HIGHLIGHT_MS;
}
