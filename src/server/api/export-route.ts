import "server-only";
import { baseUrl, handleApi } from "./http";
import {
  exportHeaders,
  exportRowBatches,
  parseExportSelection,
  streamExport,
  type ExportFormat,
} from "./export";

/** Shared handler for GET /api/export/mutants.{json,csv}. */
export function handleBulkExport(format: ExportFormat) {
  return (request: Request) =>
    handleApi(request, async () => {
      const params = Object.fromEntries(new URL(request.url).searchParams.entries());
      const selection = await parseExportSelection(params);
      const stamp = new Date().toISOString().slice(0, 10);
      const stream = streamExport(format, exportRowBatches(selection, baseUrl(request)));
      const response = new Response(stream, {
        headers: exportHeaders(format, `mutanthub-mutants-${stamp}`),
      });
      response.headers.set("X-Export-Limit", String(selection.limit));
      return response;
    });
}
