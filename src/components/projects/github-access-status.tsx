import { ExternalLink } from "lucide-react";
import { StatusPill } from "@/components/mutants/status-badge";
import { Button } from "@/components/ui/button";

export interface GitHubAccessInfo {
  mode: "mock" | "live";
  source: "mock" | "app" | "token" | "anonymous";
  appConfigured: boolean;
  installUrl: string | null;
}

const DESCRIPTION: Record<
  GitHubAccessInfo["source"],
  { label: string; tone: "success" | "info" | "warning" | "muted"; text: string }
> = {
  mock: {
    label: "Fixture repository",
    tone: "muted",
    text: "This deployment serves bundled fixture files instead of calling GitHub.",
  },
  app: {
    label: "GitHub App installed",
    tone: "success",
    text: "Contents are read with an installation token: 5,000 requests per hour dedicated to this installation.",
  },
  token: {
    label: "Shared token",
    tone: "info",
    text: "Contents are read with the deployment's personal access token, which is shared by every project.",
  },
  anonymous: {
    label: "Anonymous",
    tone: "warning",
    text: "Contents are read without credentials: 60 requests per hour for the whole server. Expect rate-limit errors.",
  },
};

export function GitHubAccessStatus({ access }: { access: GitHubAccessInfo }) {
  const info = DESCRIPTION[access.source];
  const showInstall =
    access.mode === "live" && access.appConfigured && access.source !== "app" && access.installUrl;
  return (
    <div className="space-y-3 text-xs" data-testid="github-access" data-source={access.source}>
      <div className="flex items-center gap-2">
        <StatusPill tone={info.tone}>{info.label}</StatusPill>
      </div>
      <p className="text-muted-foreground">{info.text}</p>
      {showInstall ? (
        <Button asChild variant="outline" size="sm">
          <a href={access.installUrl!} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" aria-hidden /> Install the GitHub App on this
            repository
          </a>
        </Button>
      ) : null}
      {access.mode === "live" && !access.appConfigured ? (
        <p className="text-muted-foreground">
          A GitHub App is not configured on this server. See the README to set one up for higher
          rate limits and per-repository access.
        </p>
      ) : null}
    </div>
  );
}
