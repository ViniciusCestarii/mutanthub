import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { GitHubIcon } from "@/components/shared/github-icon";
import { env } from "@/server/env";
import { getCurrentUser } from "@/server/auth/session";
import { userRepository } from "@/server/repositories/user-repository";
import { signInWithGitHubAction } from "@/server/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MockSignInForm } from "@/components/auth/mock-sign-in-form";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Sign in" };

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Could not start the GitHub sign-in flow.",
  OAuthCallback: "GitHub did not complete the sign-in.",
  AccessDenied: "Access was denied.",
  Configuration: "Authentication is not configured correctly on the server.",
  CredentialsSignin: "Unknown username.",
  Default: "Sign-in failed. Please try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(safeCallback(callbackUrl));

  const mockEnabled = env.mockAuthEnabled;
  const githubEnabled = env.githubOAuthConfigured;
  const mockUsers = mockEnabled ? await userRepository.listMockLoginUsers() : [];
  const target = safeCallback(callbackUrl);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <div className="border-border bg-card rounded-lg border p-6">
        <h1 className="text-lg font-semibold tracking-tight">Sign in to MutantHub</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Only public GitHub profile information is requested. No write access to your repositories.
        </p>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>Sign-in failed</AlertTitle>
            <AlertDescription>{ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default}</AlertDescription>
          </Alert>
        ) : null}

        {githubEnabled ? (
          <form action={signInWithGitHubAction.bind(null, target)} className="mt-6">
            <Button type="submit" className="w-full" size="lg" data-testid="github-sign-in">
              <GitHubIcon className="size-4" /> Continue with GitHub
            </Button>
          </form>
        ) : (
          <Alert className="mt-6">
            <AlertTitle>GitHub OAuth is not configured</AlertTitle>
            <AlertDescription>
              Set <code className="font-mono">AUTH_GITHUB_ID</code> and{" "}
              <code className="font-mono">AUTH_GITHUB_SECRET</code> in{" "}
              <code className="font-mono">.env</code> to enable real sign-in.
            </AlertDescription>
          </Alert>
        )}

        {mockEnabled ? (
          <div className="border-border mt-6 border-t pt-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FlaskConical className="text-muted-foreground size-4" aria-hidden />
              Development login
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Mocked authentication is enabled. Pick a seeded account or type any username to create
              one.
            </p>
            <MockSignInForm
              callbackUrl={target}
              users={mockUsers.map((u) => ({
                username: u.githubUsername,
                displayName: u.displayName,
                role: describeRole(u.globalRole, u.memberships),
              }))}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}

function safeCallback(url: string | undefined): string {
  if (!url || !url.startsWith("/") || url.startsWith("//")) return routes.dashboard();
  return url;
}

function describeRole(
  globalRole: string,
  memberships: Array<{ role: string; project: { displayName: string } }>,
): string {
  const parts: string[] = [];
  if (globalRole === "ADMIN") parts.push("admin");
  for (const m of memberships) parts.push(`${m.role.toLowerCase()} · ${m.project.displayName}`);
  return parts.length ? parts.join(", ") : "contributor";
}
