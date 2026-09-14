import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isGitHubError, type GitHubErrorKind } from "@/server/github/types";
import { codeBrowserService } from "@/server/services/code-browser-service";
import { projectService } from "@/server/services/project-service";

export const dynamic = "force-dynamic";

const STATUS_BY_KIND: Record<GitHubErrorKind, number> = {
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UNAUTHORIZED: 502,
  UNAVAILABLE: 502,
  NETWORK: 502,
  TOO_LARGE: 413,
  INVALID: 400,
};

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * GET /api/projects/:owner/:repo/tree?ref=<sha|branch>&path=<dir>
 * Lists one directory of the repository at the given ref (used by the lazy file tree).
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ owner: string; repo: string }> },
) {
  const limit = checkRateLimit({
    ...RATE_LIMITS.api,
    action: "tree-api",
    subject: clientIp(request),
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: { kind: "RATE_LIMITED", message: "Too many requests" } },
      { status: 429 },
    );
  }
  const { owner, repo } = await ctx.params;
  const url = new URL(request.url);
  const path = (url.searchParams.get("path") ?? "").replace(/^\/+|\/+$/g, "");
  const ref = url.searchParams.get("ref") ?? "";
  if (path.split("/").includes("..") || path.length > 1024) {
    return NextResponse.json(
      { error: { kind: "INVALID", message: "Invalid path" } },
      { status: 400 },
    );
  }
  try {
    const project = await projectService.getBySlugOrThrow(owner, repo);
    const { commit, entries } = await codeBrowserService.getTree(
      project,
      ref || project.defaultBranch,
      path,
    );
    return NextResponse.json({ ref: commit.sha, path, entries });
  } catch (e) {
    if (isGitHubError(e)) {
      return NextResponse.json(
        { error: { kind: e.kind, message: e.message } },
        { status: STATUS_BY_KIND[e.kind] },
      );
    }
    if (isAppError(e)) {
      return NextResponse.json(
        { error: { kind: e.code, message: e.message } },
        { status: e.status },
      );
    }
    console.error("tree api error", e);
    return NextResponse.json(
      { error: { kind: "UNAVAILABLE", message: "Unexpected error" } },
      { status: 500 },
    );
  }
}
