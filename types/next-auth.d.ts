import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    plan?: string;
    accessVerified?: boolean;
    trialEligible?: boolean;
    trialConsumed?: boolean;
    googleSub?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    plan?: string;
    googleSub?: string;
    accessVerified?: boolean;
    trialEligible?: boolean;
    trialConsumed?: boolean;
    /** Última leitura de google_account_access (ms) — evita ida ao banco em toda chamada. */
    accessCheckedAt?: number;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: number;
  }
}
