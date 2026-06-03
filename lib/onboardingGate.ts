import { supabaseAdmin } from '@/lib/supabaseClient';

export function isOnboardingPath(pathname: string): boolean {
  if (pathname === '/onboarding' || pathname.startsWith('/onboarding/')) {
    return true;
  }
  if (pathname.startsWith('/api/onboarding/')) return true;
  return false;
}

export async function hasCompletedOnboarding(ownerEmail: string): Promise<boolean> {
  const email = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('onboarding_completed')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('[onboardingGate] profile lookup:', error);
    return false;
  }
  return data?.onboarding_completed === true;
}
