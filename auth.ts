import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import {
  ensureGoogleAccount,
  getGoogleAccountBySub,
  buildAccessState,
  touchLastLoginIfVerified,
} from '@/lib/googleAccountAccess';

export const { 
  handlers: { GET, POST }, 
  auth, 
  signIn, 
  signOut 
} = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/drive.file',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      if (user) {
        token.id = user.id;
        if (user.email) token.email = user.email;
      }

      if (account?.provider === 'google') {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.tokenExpiresAt = account.expires_at
          ? account.expires_at * 1000
          : undefined;
        token.googleSub = account.providerAccountId;
        if (user?.email && account.providerAccountId) {
          try {
            await ensureGoogleAccount(account.providerAccountId, user.email);
          } catch (err) {
            console.error('[auth/jwt] ensureGoogleAccount:', err);
          }
        }
      }

      if (token.googleSub && token.email) {
        try {
          const row = await getGoogleAccountBySub(token.googleSub as string);
          const state = buildAccessState(
            row,
            String(token.email),
            token.googleSub as string,
          );
          token.accessVerified = state.accessVerified;
          token.trialEligible = state.trialEligible;
          token.trialConsumed = state.trialConsumed;

          if (state.accessVerified) {
            await touchLastLoginIfVerified(token.googleSub as string);
          }
        } catch (err) {
          console.error('[auth/jwt] google account access:', err);
          token.accessVerified = false;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as { id?: string }).id = token.id as string;
      }
      // Tokens Google ficam apenas no JWT (servidor). Não expor ao cliente via useSession.
      session.tokenExpiresAt = token.tokenExpiresAt as number | undefined;
      session.googleSub = token.googleSub as string | undefined;
      session.accessVerified = token.accessVerified === true;
      session.trialEligible = token.trialEligible !== false;
      session.trialConsumed = token.trialConsumed === true;
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
});

