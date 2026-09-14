import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      githubUsername: string;
    } & DefaultSession["user"];
  }

  interface User {
    githubId?: string;
    githubUsername?: string;
    /** Internal database id, set during sign-in. */
    internalId?: string;
  }
}

// next-auth re-exports @auth/core/jwt, so the augmentation must target the source module.
declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    githubUsername?: string;
  }
}
