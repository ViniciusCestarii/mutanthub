import "server-only";
import { env } from "@/server/env";
import type { CheckSummary } from "@/domain/pull-requests/check-summary";
import { findInstallationId, getInstallationToken } from "./app-auth";

const API_BASE = "https://api.github.com";
const CHECK_NAME = "MutantHub";

export interface PublishCheckInput {
  owner: string;
  repo: string;
  headSha: string;
  summary: CheckSummary;
  detailsUrl: string;
  /** Existing check run to update instead of creating a new one. */
  checkRunId?: string | null;
}

/**
 * Creates or updates the "MutantHub" check run on a pull request head.
 * Requires the GitHub App with the Checks: write permission installed on the
 * repository; returns null (and does nothing) otherwise, so environments
 * without the app keep working.
 */
export async function publishCheckRun(input: PublishCheckInput): Promise<string | null> {
  if (env.resolvedGithubMode !== "live" || !env.githubAppConfigured) return null;
  const installationId = await findInstallationId(input.owner, input.repo);
  if (!installationId) return null;
  const token = await getInstallationToken(installationId);

  const body = {
    name: CHECK_NAME,
    head_sha: input.headSha,
    status: "completed",
    conclusion: input.summary.conclusion,
    details_url: input.detailsUrl,
    output: {
      title: input.summary.title,
      summary: input.summary.text.slice(0, 65_000),
    },
  };
  const base = `${API_BASE}/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/check-runs`;
  const url = input.checkRunId ? `${base}/${input.checkRunId}` : base;
  const response = await fetch(url, {
    method: input.checkRunId ? "PATCH" : "POST",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "MutantHub",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    console.error(
      `[check-run] GitHub responded with ${response.status} for ${input.owner}/${input.repo}@${input.headSha}`,
    );
    return null;
  }
  const data = (await response.json()) as { id: number };
  return String(data.id);
}
