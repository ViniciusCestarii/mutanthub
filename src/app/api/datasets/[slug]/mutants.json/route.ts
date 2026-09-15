import { handleSnapshotDownload } from "@/server/api/snapshot-route";

export const dynamic = "force-dynamic";

/** GET /api/datasets/:slug/mutants.json — a frozen, citable snapshot as JSON. */
export const GET = handleSnapshotDownload("json");
