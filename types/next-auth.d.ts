import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
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
    googleSub?: string;
    accessVerified?: boolean;
    trialEligible?: boolean;
    trialConsumed?: boolean;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: number;
  }
}
