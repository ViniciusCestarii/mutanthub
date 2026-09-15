import "server-only";
import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type {
  KillClaimApplies,
  KillClaimKind,
  KillClaimStatus,
  PullRequestState,
} from "@/generated/prisma/enums";
import { userSummarySelect } from "./user-repository";

export const killClaimInclude = {
  claimedBy: { select: userSummarySelect },
  resolvedBy: { select: userSummarySelect },
  pullRequest: {
    select: { id: true, number: true, title: true, state: true, htmlUrl: true, headSha: true },
  },
  validations: {
    select: {
      id: true,
      result: true,
      commitSha: true,
      createdAt: true,
      user: { select: userSummarySelect },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.KillClaimInclude;

export type KillClaimItem = Prisma.KillClaimGetPayload<{ include: typeof killClaimInclude }>;

export interface CreateKillClaimData {
  mutantId: number;
  claimedById: string;
  kind: KillClaimKind;
  reference: string;
  note: string | null;
  pullRequestId: string | null;
  prState: PullRequestState | null;
  prTouchesTests: boolean | null;
  verifyCommitSha: string | null;
  applies: KillClaimApplies;
  appliesLine: number | null;
  status: KillClaimStatus;
}

export const killClaimRepository = {
  listForMutant(mutantId: number) {
    return prisma.killClaim.findMany({
      where: { mutantId },
      include: killClaimInclude,
      orderBy: { createdAt: "asc" },
    });
  },

  listForPullRequest(pullRequestId: string) {
    return prisma.killClaim.findMany({
      where: { pullRequestId },
      include: {
        ...killClaimInclude,
        mutant: { select: { id: true, title: true, mutationStatus: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  },

  findById(id: string) {
    return prisma.killClaim.findUnique({
      where: { id },
      include: {
        ...killClaimInclude,
        mutant: {
          select: {
            id: true,
            title: true,
            filePath: true,
            startLine: true,
            originalCode: true,
            mutationStatus: true,
            createdById: true,
            projectId: true,
            project: true,
          },
        },
      },
    });
  },

  findDuplicate(mutantId: number, kind: KillClaimKind, reference: string) {
    return prisma.killClaim.findFirst({ where: { mutantId, kind, reference } });
  },

  create(data: CreateKillClaimData) {
    return prisma.killClaim.create({
      data: { ...data, lastCheckedAt: new Date() },
      include: killClaimInclude,
    });
  },

  updateChecks(
    id: string,
    data: {
      prState?: PullRequestState | null;
      prTouchesTests?: boolean | null;
      verifyCommitSha?: string | null;
      applies?: KillClaimApplies;
      appliesLine?: number | null;
      status?: KillClaimStatus;
    },
  ) {
    return prisma.killClaim.update({
      where: { id },
      data: { ...data, lastCheckedAt: new Date() },
      include: killClaimInclude,
    });
  },

  resolve(
    id: string,
    data: { status: KillClaimStatus; resolvedById: string | null; resolutionNote: string | null },
  ) {
    return prisma.killClaim.update({
      where: { id },
      data: { ...data, resolvedAt: new Date() },
      include: killClaimInclude,
    });
  },

  countByMutant(mutantIds: number[]) {
    return prisma.killClaim.groupBy({
      by: ["mutantId", "status"],
      where: { mutantId: { in: mutantIds } },
      _count: { _all: true },
    });
  },
};
