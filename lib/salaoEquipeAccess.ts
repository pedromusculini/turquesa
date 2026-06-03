export type SalaoEquipeProfile = {
  user_type?: string | null;
  plan?: string | null;
};

/** Plano único ilimitado — titulares com perfil sempre gerenciam profissionais. */
export function canManageProfissionais(
  profile: SalaoEquipeProfile | null | undefined,
): boolean {
  return !!profile;
}
