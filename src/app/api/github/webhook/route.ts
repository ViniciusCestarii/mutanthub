import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { invalidateInstallationCache, verifyWebhookSignature } from "@/server/github/app-auth";
import { projectRepository } from "@/server/repositories/project-repository";
import { pullRequestService } from "@/server/services/pull-request-service";

export const dynamic = "force-dynamic";

interface PullRequestEvent {
  action?: string;
  number?: number;
  repository?: { full_name: string };
}

interface InstallationEvent {
  action?: string;
  installation?: { id: number; account?: { login?: string } };
  repositories?: Array<{ full_name: string }>;
  repositories_added?: Array<{ full_name: string }>;
  repositories_removed?: Array<{ full_name: string }>;
}

function splitFullName(fullName: string): { owner: string; repo: string } | null {
  const [owner, repo] = fullName.split("/");
  return owner && repo ? { owner, repo } : null;
}

/**
 * POST /api/github/webhook — GitHub App webhook receiver.
 * Only installation lifecycle events matter today: they invalidate the cached
 * "which installation covers this repository" lookups so browsing picks up
 * the new credentials immediately. Every payload is verified with the
 * webhook secret before it is parsed.
 */
export async function POST(request: Request) {
  const secret = env.githubAppWebhookSecret;
  if (!secret)
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });

  const rawBody = await request.text();
  if (!verifyWebhookSignature(secret, rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event") ?? "";
  if (event === "ping") return NextResponse.json({ ok: true, pong: true });
  if (event === "pull_request") return handlePullRequest(rawBody);
  if (event !== "installation" && event !== "installation_repositories") {
    return NextResponse.json({ ok: true, ignored: event });
  }

  let payload: InstallationEvent;
  try {
    payload = JSON.parse(rawBody) as InstallationEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const repos = [
    ...(payload.repositories ?? []),
    ...(payload.repositories_added ?? []),
    ...(payload.repositories_removed ?? []),
  ]
    .map((r) => splitFullName(r.full_name))
    .filter((r): r is { owner: string; repo: string } => r !== null);
  await invalidateInstallationCache(repos);

  console.info(
    `[github-app] ${event}.${payload.action ?? "?"} installation=${payload.installation?.id ?? "?"} account=${payload.installation?.account?.login ?? "?"} repos=${repos.length}`,
  );
  return NextResponse.json({ ok: true, invalidated: repos.length });
}

const SYNC_ACTIONS = new Set([
  "opened",
  "reopened",
  "synchronize",
  "closed",
  "edited",
  "ready_for_review",
]);

/** Keeps tracked (or newly opened) pull requests of registered projects in sync. */
async function handlePullRequest(rawBody: string) {
  let payload: PullRequestEvent;
  try {
    payload = JSON.parse(rawBody) as PullRequestEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const full = payload.repository?.full_name ? splitFullName(payload.repository.full_name) : null;
  if (!full || !payload.number || !SYNC_ACTIONS.has(payload.action ?? "")) {
    return NextResponse.json({ ok: true, ignored: `pull_request.${payload.action ?? "?"}` });
  }
  const project = await projectRepository.findBySlug(full.owner, full.repo);
  if (!project || !project.isActive)
    return NextResponse.json({ ok: true, ignored: "unregistered repository" });
  try {
    const pr = await pullRequestService.sync(project, payload.number);
    return NextResponse.json({ ok: true, synced: pr.number, state: pr.state });
  } catch (error) {
    console.error("[github-app] pull_request sync failed", (error as Error).message);
    return NextResponse.json({ ok: false, error: "sync failed" }, { status: 502 });
  }
}
