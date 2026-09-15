"use server";

import { signIn, signOut } from "@/server/auth";
import { routes } from "@/lib/routes";
import { safeRelativePath } from "@/lib/safe-redirect";

export async function signOutAction() {
  await signOut({ redirectTo: routes.home() });
}

export async function signInWithGitHubAction(callbackUrl?: string) {
  await signIn("github", { redirectTo: safeRelativePath(callbackUrl, routes.dashboard()) });
}

/** Dev/test only: the provider is not registered unless mock auth is enabled. */
export async function mockSignInAction(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const callbackUrl = safeRelativePath(
    String(formData.get("callbackUrl") ?? ""),
    routes.dashboard(),
  );
  await signIn("mock", { username, redirectTo: callbackUrl });
}
