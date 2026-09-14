import "server-only";
import { cache } from "react";
import { auth } from "./index";
import { userRepository } from "@/server/repositories/user-repository";
import type { Principal } from "@/domain/auth/permissions";
import { unauthenticated } from "@/lib/errors";

export interface CurrentUser extends Principal {
  githubUsername: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
}

/**
 * Loads the signed-in user (with memberships) once per request. Returns null
 * for anonymous visitors or when the JWT references a deleted user.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const user = await userRepository.findPrincipalById(userId);
  if (!user) return null;
  return {
    id: user.id,
    globalRole: user.globalRole,
    memberships: user.memberships,
    githubUsername: user.githubUsername,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    email: user.email,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthenticated();
  return user;
}
