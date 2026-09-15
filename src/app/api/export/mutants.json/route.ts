import { handleBulkExport } from "@/server/api/export-route";

export const dynamic = "force-dynamic";

/** GET /api/export/mutants.json — streamed JSON array; filters as in /api/mutants plus `limit`. */
export const GET = handleBulkExport("json");
