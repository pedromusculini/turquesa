/** Poll until google_account_access marks e-mail verified (after OTP). */
export async function waitForEmailVerified(
  maxAttempts = 12,
  intervalMs = 400,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch('/api/auth/google-access/status', {
        cache: 'no-store',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.accessVerified) return true;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}
