import { mutantService } from "@/server/services/mutant-service";
import { apiError, handleApi } from "@/server/api/http";

export const dynamic = "force-dynamic";

/** GET /api/mutants/:id/patch — the stored unified diff as a downloadable patch file. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(request, async () => {
    const { id } = await ctx.params;
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) return apiError(400, "Invalid mutant id");
    const { mutant } = await mutantService.getDetail(null, numeric);
    const header = [
      `# MutantHub mutant #${mutant.id}: ${mutant.title}`,
      `# Repository: ${mutant.project.githubOwner}/${mutant.project.githubRepository} @ ${mutant.revision.commitSha}`,
      `# File: ${mutant.filePath}:${mutant.startLine}-${mutant.endLine}`,
      `# Review: ${mutant.reviewStatus}; outcome: ${mutant.mutationStatus}`,
      "",
    ].join("\n");
    return new Response(
      `${header}${mutant.gitDiff.endsWith("\n") ? mutant.gitDiff : `${mutant.gitDiff}\n`}`,
      {
        headers: {
          "Content-Type": "text/x-patch; charset=utf-8",
          "Content-Disposition": `attachment; filename="mutant-${mutant.id}.patch"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  });
}
