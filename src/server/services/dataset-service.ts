import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Principal } from "@/domain/auth/permissions";
import { isAdmin } from "@/domain/auth/permissions";
import { hashRows, snapshotSlug } from "@/domain/dataset/hash";
import { EXPORT_MAX_ROWS } from "@/domain/dataset/export-row";
import { conflict, forbidden, notFound, validationError } from "@/lib/errors";
import { enforceRateLimit } from "@/server/infra/rate-limit";
import { collectExportRows, parseExportSelection } from "@/server/api/export";
import { auditRepository } from "@/server/repositories/audit-repository";
import { datasetRepository } from "@/server/repositories/dataset-repository";
import { createSnapshotSchema, fieldErrors } from "@/lib/validation/schemas";

function appBaseUrl(): string {
  return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export const datasetService = {
  list() {
    return datasetRepository.list();
  },

  async getBySlug(slug: string) {
    const snapshot = await datasetRepository.findBySlug(slug);
    if (!snapshot) throw notFound("Snapshot");
    return snapshot;
  },

  /**
   * Freezes the rows matching the given filters into a citable snapshot.
   * Admin only: snapshots are permanent and publicly downloadable.
   */
  async createSnapshot(principal: Principal | null, rawInput: unknown) {
    if (!principal || !isAdmin(principal))
      throw forbidden("Only administrators can publish snapshots");
    const parsed = createSnapshotSchema.safeParse(rawInput);
    if (!parsed.success)
      throw validationError("Please fix the highlighted fields", fieldErrors(parsed.error));
    const input = parsed.data;
    await enforceRateLimit({
      action: "snapshot",
      subject: principal.id,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });

    const selection = await parseExportSelection({
      ...(input.project ? { project: input.project } : {}),
      ...(input.reviewStatus ? { reviewStatus: input.reviewStatus } : {}),
      ...(input.mutationStatus ? { mutationStatus: input.mutationStatus } : {}),
      limit: String(EXPORT_MAX_ROWS),
    });
    if (selection.emptyProject)
      throw validationError("Unknown project", { project: "Project not found" });
    const rows = await collectExportRows(selection, appBaseUrl());
    if (rows.length === 0)
      throw validationError("No mutants match these filters", { project: "Nothing to publish" });

    const now = new Date();
    let slug = snapshotSlug(input.name, now);
    if (await datasetRepository.findBySlug(slug)) {
      slug = `${slug}-${now.getTime().toString(36)}`;
      if (await datasetRepository.findBySlug(slug))
        throw conflict("A snapshot with this name already exists today");
    }

    const snapshot = await datasetRepository.create({
      slug,
      name: input.name,
      description: input.description ?? null,
      filters: selection.filters,
      rowCount: rows.length,
      contentHash: hashRows(rows),
      data: rows as unknown as Prisma.InputJsonValue,
      createdById: principal.id,
    });
    await auditRepository.record({
      actorId: principal.id,
      action: "DATASET_PUBLISHED",
      targetType: "dataset",
      targetId: snapshot.id,
      metadata: { slug: snapshot.slug, rows: snapshot.rowCount, hash: snapshot.contentHash },
    });
    return snapshot;
  },
};

/** Text a paper can paste to reference a snapshot. */
export function citationFor(
  snapshot: { slug: string; name: string; rowCount: number; contentHash: string; createdAt: Date },
  baseUrl: string,
): string {
  const date = snapshot.createdAt.toISOString().slice(0, 10);
  return [
    `MutantHub dataset snapshot "${snapshot.name}" (${date}), ${snapshot.rowCount} mutants.`,
    `${baseUrl}/datasets/${snapshot.slug}`,
    `SHA-256 ${snapshot.contentHash}`,
  ].join("\n");
}
