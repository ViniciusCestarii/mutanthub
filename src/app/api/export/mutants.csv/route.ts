import { handleBulkExport } from "@/server/api/export-route";

export const dynamic = "force-dynamic";

/** GET /api/export/mutants.csv — streamed RFC 4180 CSV; filters as in /api/mutants plus `limit`. */
export const GET = handleBulkExport("csv");
