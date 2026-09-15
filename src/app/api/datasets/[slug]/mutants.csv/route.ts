import { handleSnapshotDownload } from "@/server/api/snapshot-route";

export const dynamic = "force-dynamic";

/** GET /api/datasets/:slug/mutants.csv — a frozen, citable snapshot as CSV. */
export const GET = handleSnapshotDownload("csv");
