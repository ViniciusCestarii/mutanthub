import "server-only";
import type { ExportRow } from "@/domain/dataset/export-row";
import { datasetRepository } from "@/server/repositories/dataset-repository";
import { apiError, handleApi } from "./http";
import { exportHeaders, rowsAsBatches, streamExport, type ExportFormat } from "./export";

/** Shared handler for GET /api/datasets/[slug]/mutants.{json,csv}: serves the frozen rows. */
export function handleSnapshotDownload(format: ExportFormat) {
  return (request: Request, ctx: { params: Promise<{ slug: string }> }) =>
    handleApi(request, async () => {
      const { slug } = await ctx.params;
      const snapshot = await datasetRepository.findDataBySlug(slug);
      if (!snapshot) return apiError(404, "Snapshot not found");
      const rows = snapshot.data as unknown as ExportRow[];
      const response = new Response(streamExport(format, rowsAsBatches(rows)), {
        headers: exportHeaders(format, `mutanthub-${snapshot.slug}`),
      });
      response.headers.set("X-Dataset-Rows", String(snapshot.rowCount));
      response.headers.set("X-Dataset-Sha256", snapshot.contentHash);
      response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
      return response;
    });
}
