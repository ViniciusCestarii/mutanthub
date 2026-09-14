import { NextResponse } from "next/server";
import { mutantService } from "@/server/services/mutant-service";
import { serializeMutantDetail } from "@/server/api/serializers";
import { apiError, baseUrl, handleApi } from "@/server/api/http";

export const dynamic = "force-dynamic";

/** GET /api/mutants/:id — full record including diff, evidence, validations and history. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleApi(request, async () => {
    const { id } = await ctx.params;
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) return apiError(400, "Invalid mutant id");
    const detail = await mutantService.getDetail(null, numeric);
    return NextResponse.json({ data: serializeMutantDetail(detail.mutant, baseUrl(request)) });
  });
}
