export function buildConsultaInicioBr(data: string, hora: string | null): string {
  const hh = hora && /^\d{1,2}:\d{2}/.test(hora) ? hora.slice(0, 5) : '09:00';
  const [h, m] = hh.split(':').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${data}T${pad(h)}:${pad(m)}:00-03:00`;
}
