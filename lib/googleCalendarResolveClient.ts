import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import type { GoogleCalendarResolveResult } from '@/lib/googleCalendarEventLookup';

/** Cliente: evento Google ainda existe em alguma agenda do salão? */
export async function resolveGoogleCalendarEvent(
  eventId: string,
): Promise<GoogleCalendarResolveResult> {
  if (typeof window === 'undefined' || !eventId.trim()) {
    return { found: false };
  }

  try {
    const params = new URLSearchParams({ eventId: eventId.trim() });
    const res = await fetchWithTimeout(
      `/api/google-calendar/resolve?${params.toString()}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return { found: false };
    return (await res.json()) as GoogleCalendarResolveResult;
  } catch {
    return { found: false };
  }
}
