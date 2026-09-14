import { NextResponse } from "next/server";
import { mutantService } from "@/server/services/mutant-service";
import { serializeMutant } from "@/server/api/serializers";
import { baseUrl, handleApi } from "@/server/api/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/mutants
 *
 * Public, read-only listing of mutants for dataset consumers.
 * Query parameters (all optional): project=owner/repo, language, operator,
 * reviewStatus, mutationStatus, contributor, commit, file, q, page, pageSize.
 * See /api/docs for the full description.
 */
export async function GET(request: Request) {
  return handleApi(request, async () => {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const { items, total, filter } = await mutantService.list(params);
    const base = baseUrl(request);
    return NextResponse.json({
      data: items.map((m) => serializeMutant(m, base)),
      pagination: {
        page: filter.page,
        pageSize: filter.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / filter.pageSize)),
      },
      filters: {
        project: filter.project ?? null,
        language: filter.language ?? null,
        operator: filter.operator ?? null,
        reviewStatus: filter.reviewStatus ?? null,
        mutationStatus: filter.mutationStatus ?? null,
        contributor: filter.contributor ?? null,
        commit: filter.commit ?? null,
        file: filter.file ?? null,
        q: filter.q ?? null,
      },
    });
  });
}
