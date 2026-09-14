import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { env } from "@/server/env";
import { userRepository } from "@/server/repositories/user-repository";

/**
 * Auth.js configuration.
 *
 * - GitHub OAuth with read-only scopes is the real provider.
 * - A credentials provider ("mock") lets developers and E2E tests sign in as
 *   any username without GitHub. It is only registered when
 *   `env.mockAuthEnabled` is true (never in production unless explicitly forced).
 *
 * Sessions are stateless JWTs holding only the internal user id; role and
 * memberships are always loaded fresh from the database on the server.
 */
function buildProviders(): NextAuthConfig["providers"] {
  const providers: NextAuthConfig["providers"] = [];

  if (env.githubOAuthConfigured) {
    providers.push(
      GitHub({
        clientId: env.githubClientId,
        clientSecret: env.githubClientSecret,
        authorization: { params: { scope: "read:user user:email" } },
        profile(profile) {
          return {
            id: String(profile.id),
            name: profile.name ?? profile.login,
            email: profile.email,
            image: profile.avatar_url,
            githubId: String(profile.id),
            githubUsername: profile.login,
          };
        },
      }),
    );
  }

  if (env.mockAuthEnabled) {
    providers.push(
      Credentials({
        id: "mock",
        name: "Mock login",
        credentials: { username: { label: "GitHub username", type: "text" } },
        async authorize(credentials) {
          const username = String(credentials?.username ?? "")
            .trim()
            .toLowerCase();
          if (!/^[a-z0-9-]{1,39}$/.test(username)) return null;
          const user = await userRepository.findOrCreateMockUser(username);
          return {
            id: user.id,
            name: user.displayName,
            email: user.email,
            image: user.avatarUrl,
            githubId: user.githubId ?? undefined,
            githubUsername: user.githubUsername,
            internalId: user.id,
          };
        },
      }),
    );
  }

  return providers;
}

export const authConfig: NextAuthConfig = {
  secret: env.authSecret,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/signin", error: "/signin" },
  providers: buildProviders(),
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "github") {
        if (!user.githubId || !user.githubUsername) return false;
        const dbUser = await userRepository.upsertFromGitHub({
          githubId: user.githubId,
          githubUsername: user.githubUsername,
          displayName: user.name ?? user.githubUsername,
          avatarUrl: user.image ?? null,
          email: user.email ?? null,
        });
        user.internalId = dbUser.id;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.internalId) {
        token.userId = user.internalId;
        token.githubUsername = user.githubUsername;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId;
        session.user.githubUsername = token.githubUsername ?? "";
      }
      return session;
    },
  },
};
