import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import {
  ensureGoogleAccount,
  getGoogleAccountBySub,
  buildAccessState,
  touchLastLoginIfVerified,
  markEmailVerified,
} from '@/lib/googleAccountAccess';
import {
  applyDevBypassToToken,
  getDevMockSession,
  isDevBypassAuthActive,
} from '@/lib/devBypassAuth';
import { googleLoginScopeParam } from '@/lib/googleOAuthScopes';
import { saveOwnerGoogleTokens } from '@/lib/ownerGoogleTokens';

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: googleLoginScopeParam(),
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
    async signIn({ account, user }) {
      if (account?.provider !== 'google') return true;

      if (account.refresh_token && account.providerAccountId) {
        const saved = await saveOwnerGoogleTokens(
          account.providerAccountId,
          account.refresh_token,
          'all',
        );
        if (!saved) {
          console.warn(
            `[auth/signIn] refresh token não persistido para sub ${account.providerAccountId.slice(0, 8)}… — login continua`,
          );
        }
      }

      if (user?.email && account.providerAccountId) {
        try {
          await markEmailVerified(account.providerAccountId, user.email);
        } catch (err) {
          console.error('[auth/signIn] markEmailVerified:', err);
          try {
            await ensureGoogleAccount(account.providerAccountId, user.email);
          } catch (err2) {
            console.error('[auth/signIn] ensureGoogleAccount fallback:', err2);
          }
        }
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (isDevBypassAuthActive()) {
        return applyDevBypassToToken(token);
      }

      if (user) {
        token.id = user.id;
        if (user.email) token.email = user.email;
      }

      if (account?.provider === 'google') {
        token.tokenExpiresAt = account.expires_at
          ? account.expires_at * 1000
          : undefined;
        token.googleSub = account.providerAccountId;
        // Tokens Google ficam em owner_google_integracao — não serializar no cookie JWT (~4KB).
        delete token.accessToken;
        delete token.refreshToken;

        if (user?.email && account.providerAccountId) {
          try {
            await markEmailVerified(account.providerAccountId, user.email);
          } catch (err) {
            console.error('[auth/jwt] markEmailVerified:', err);
            try {
              await ensureGoogleAccount(account.providerAccountId, user.email);
            } catch (err2) {
              console.error('[auth/jwt] ensureGoogleAccount fallback:', err2);
            }
          }
        }
        if (account.refresh_token && account.providerAccountId) {
          const saved = await saveOwnerGoogleTokens(
            account.providerAccountId,
            account.refresh_token,
            'all',
          );
          if (!saved) {
            console.warn(
              `[auth/jwt] refresh token não persistido para sub ${account.providerAccountId.slice(0, 8)}…`,
            );
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
      if (isDevBypassAuthActive()) {
        const mock = getDevMockSession();
        return {
          ...session,
          ...mock,
          user: { ...session.user, ...mock.user },
        };
      }

      if (session.user && token.id) {
        (session.user as { id?: string }).id = token.id as string;
      }
      // Tokens Google ficam apenas no JWT (servidor). Não expor ao cliente via useSession.
      session.tokenExpiresAt = token.tokenExpiresAt as number | undefined;
      session.googleSub = token.googleSub as string | undefined;
      session.plan = token.plan as string | undefined;
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
