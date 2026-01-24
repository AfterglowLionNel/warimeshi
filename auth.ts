import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";

// LINE OAuth Provider
function LineProvider() {
  return {
    id: "line",
    name: "LINE",
    type: "oauth" as const,
    authorization: {
      url: "https://access.line.me/oauth2/v2.1/authorize",
      params: { scope: "profile" },
    },
    token: {
      url: "https://api.line.me/oauth2/v2.1/token",
      async request({ params, provider }: { params: URLSearchParams; provider: { clientId?: string; clientSecret?: string; token?: { url?: string } } }) {
        const response = await fetch(provider.token?.url ?? "https://api.line.me/oauth2/v2.1/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: params.get("code") ?? "",
            redirect_uri: params.get("redirect_uri") ?? "",
            client_id: provider.clientId ?? "",
            client_secret: provider.clientSecret ?? "",
          }),
        });
        const tokens = await response.json();
        // Return only access_token to skip ID token verification
        return { tokens: { access_token: tokens.access_token } };
      },
    },
    userinfo: {
      url: "https://api.line.me/v2/profile",
      async request({ tokens }: { tokens: { access_token?: string } }) {
        const res = await fetch("https://api.line.me/v2/profile", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        return await res.json();
      },
    },
    checks: ["state"] as ("state" | "pkce" | "none")[],
    profile(profile: {
      sub?: string;
      name?: string;
      email?: string;
      picture?: string;
      userId?: string;
      displayName?: string;
      pictureUrl?: string;
    }) {
      return {
        id: profile.userId || profile.sub || "",
        name: profile.displayName || profile.name,
        email: profile.email || null,
        image: profile.pictureUrl || profile.picture,
      };
    },
    clientId: process.env.AUTH_LINE_ID,
    clientSecret: process.env.AUTH_LINE_SECRET,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  cookies: {
    pkceCodeVerifier: {
      name: "authjs.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    state: {
      name: "authjs.state",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 900, // 15 minutes
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || (token.sub as string);
        session.user.name = session.user.name ?? (token.name as string | undefined);
        session.user.email = session.user.email ?? (token.email as string | undefined);
        session.user.image = session.user.image ?? (token.picture as string | undefined);
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  providers: [
    Google({
      allowDangerousEmailAccountLinking: true,
    }),
    LineProvider(),
  ],
});
