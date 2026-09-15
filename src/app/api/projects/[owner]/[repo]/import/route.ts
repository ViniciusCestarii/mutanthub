import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { projectService } from "@/server/services/project-service";
import { importService } from "@/server/services/import-service";
import { IMPORT_MAX_BYTES } from "@/domain/import/schema";
import { isAppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/projects/:owner/:repo/import — multipart upload of a mutants file.
 * Fields: `file` (JSON or JSON Lines), `mode` ("dry-run" | "commit"),
 * optional `toolName` and `toolVersion`. Admin only; same-origin only.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ owner: string; repo: string }> },
) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to import" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Attach a file" }, { status: 400 });
  if (file.size > IMPORT_MAX_BYTES) {
    return NextResponse.json(
      { error: `File is larger than ${IMPORT_MAX_BYTES / (1024 * 1024)} MB` },
      { status: 413 },
    );
  }
  const mode = String(form.get("mode") ?? "dry-run");
  const override = {
    toolName: optionalString(form.get("toolName")),
    toolVersion: optionalString(form.get("toolVersion")),
  };

  try {
    const { owner, repo } = await ctx.params;
    const project = await projectService.getBySlugOrThrow(owner, repo);
    const text = await file.text();
    if (mode === "commit") {
      const result = await importService.commit(user, project, text, file.name || null, override);
      return NextResponse.json({
        ok: true,
        batchId: result.batch.id,
        created: result.createdIds.length,
        report: result.report,
      });
    }
    const report = await importService.dryRun(user, project, text, file.name || null, override);
    return NextResponse.json({ ok: true, report: report.report });
  } catch (e) {
    if (isAppError(e))
      return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
    console.error("[import] failed", e);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}

function optionalString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Browser-enforced CSRF check for the upload endpoint (no Next.js action origin check here). */
function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
