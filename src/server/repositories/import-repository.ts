import "server-only";
import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { MutationOperator, MutationStatus, ObservedResult } from "@/generated/prisma/enums";
import { userSummarySelect } from "./user-repository";

export const importBatchSelect = {
  id: true,
  toolName: true,
  toolVersion: true,
  fileName: true,
  rowCount: true,
  createdCount: true,
  skippedCount: true,
  errorCount: true,
  createdAt: true,
  importedBy: { select: userSummarySelect },
} satisfies Prisma.ImportBatchSelect;

export type ImportBatchSummary = Prisma.ImportBatchGetPayload<{ select: typeof importBatchSelect }>;

export interface ImportMutantData {
  revisionId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  originalCode: string;
  mutatedCode: string;
  gitDiff: string;
  mutationOperator: MutationOperator;
  title: string;
  description: string | null;
  fingerprint: string;
  mutationStatus: MutationStatus;
  externalId: string | null;
  submission: {
    buildCommand: string | null;
    testCommand: string;
    fuzzCommand: string | null;
    testDurationSeconds: number | null;
    environmentDescription: string;
    observedResult: ObservedResult;
    notes: string | null;
  };
}

export const importRepository = {
  listForProject(projectId: string, take = 20) {
    return prisma.importBatch.findMany({
      where: { projectId },
      select: importBatchSelect,
      orderBy: { createdAt: "desc" },
      take,
    });
  },

  findById(id: string) {
    return prisma.importBatch.findUnique({
      where: { id },
      select: { ...importBatchSelect, report: true, project: true },
    });
  },

  /**
   * Creates the batch and every mutant (approved, with submission and history)
   * in one transaction, then a single activity row for the whole import.
   */
  createBatch(params: {
    projectId: string;
    importedById: string;
    toolName: string;
    toolVersion: string | null;
    fileName: string | null;
    rowCount: number;
    skippedCount: number;
    errorCount: number;
    report: Prisma.InputJsonValue;
    mutants: ImportMutantData[];
  }) {
    return prisma.$transaction(
      async (tx) => {
        const batch = await tx.importBatch.create({
          data: {
            projectId: params.projectId,
            importedById: params.importedById,
            toolName: params.toolName,
            toolVersion: params.toolVersion,
            fileName: params.fileName,
            rowCount: params.rowCount,
            createdCount: params.mutants.length,
            skippedCount: params.skippedCount,
            errorCount: params.errorCount,
            report: params.report,
          },
        });
        const ids: number[] = [];
        const provenance = `Imported from ${params.toolName}${params.toolVersion ? ` ${params.toolVersion}` : ""} by an administrator`;
        for (const m of params.mutants) {
          const { submission, ...fields } = m;
          const created = await tx.mutant.create({
            data: {
              ...fields,
              projectId: params.projectId,
              createdById: params.importedById,
              reviewStatus: "APPROVED",
              importBatchId: batch.id,
              toolName: params.toolName,
              submissions: { create: { ...submission, submittedById: params.importedById } },
              statusHistory: {
                create: [
                  {
                    kind: "REVIEW",
                    previousValue: null,
                    newValue: "APPROVED",
                    changedById: params.importedById,
                    comment: provenance,
                  },
                  {
                    kind: "MUTATION",
                    previousValue: null,
                    newValue: m.mutationStatus,
                    changedById: params.importedById,
                    comment: "Result reported by the tool",
                  },
                ],
              },
            },
            select: { id: true },
          });
          ids.push(created.id);
        }
        await tx.activity.create({
          data: {
            type: "MUTANTS_IMPORTED",
            actorId: params.importedById,
            projectId: params.projectId,
            payload: {
              batchId: batch.id,
              tool: params.toolName,
              created: ids.length,
              skipped: params.skippedCount,
            },
          },
        });
        return { batch, ids };
      },
      { timeout: 120_000 },
    );
  },
};
