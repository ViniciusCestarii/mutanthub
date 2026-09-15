import "server-only";
import { summarizeValidations } from "@/domain/mutants/validation-summary";
import type { MutantListItem, MutantDetail } from "@/server/repositories/mutant-repository";

/** Public dataset representation of a mutant (stable shape for exports). */
export interface PublicMutant {
  id: number;
  repository: string;
  commit: string;
  file: string;
  startLine: number;
  endLine: number;
  title: string;
  mutationOperator: string;
  reviewStatus: string;
  mutationStatus: string;
  reproductions: number;
  reproductionSummary: {
    survived: number;
    killed: number;
    couldNotReproduce: number;
    consensus: string;
  };
  contributor: string;
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface PublicMutantDetail extends PublicMutant {
  description: string | null;
  originalCode: string;
  mutatedCode: string;
  diff: string;
  duplicateOf: number | null;
  submissions: Array<{
    submittedBy: string;
    buildCommand: string | null;
    testCommand: string;
    fuzzCommand: string | null;
    testDurationSeconds: number | null;
    environment: string | null;
    operatingSystem: string | null;
    compiler: string | null;
    observedResult: string;
    notes: string | null;
    createdAt: string;
  }>;
  validations: Array<{
    user: string;
    result: string;
    command: string | null;
    environment: string | null;
    notes: string | null;
    killingTestRef: string | null;
    createdAt: string;
  }>;
  history: Array<{
    kind: string;
    from: string | null;
    to: string;
    changedBy: string | null;
    comment: string | null;
    createdAt: string;
  }>;
}

export function serializeMutant(m: MutantListItem, baseUrl: string): PublicMutant {
  const summary = summarizeValidations(m.validations.map((v) => v.result));
  return {
    id: m.id,
    repository: `${m.project.githubOwner}/${m.project.githubRepository}`,
    commit: m.revision.commitSha,
    file: m.filePath,
    startLine: m.startLine,
    endLine: m.endLine,
    title: m.title,
    mutationOperator: m.mutationOperator,
    reviewStatus: m.reviewStatus,
    mutationStatus: m.mutationStatus,
    reproductions: summary.total,
    reproductionSummary: {
      survived: summary.survived,
      killed: summary.killed,
      couldNotReproduce: summary.couldNotReproduce,
      consensus: summary.consensus,
    },
    contributor: m.createdBy.githubUsername,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    url: `${baseUrl}/mutants/${m.id}`,
  };
}

export function serializeMutantDetail(m: MutantDetail, baseUrl: string): PublicMutantDetail {
  const summary = summarizeValidations(m.validations.map((v) => v.result));
  return {
    id: m.id,
    repository: `${m.project.githubOwner}/${m.project.githubRepository}`,
    commit: m.revision.commitSha,
    file: m.filePath,
    startLine: m.startLine,
    endLine: m.endLine,
    title: m.title,
    mutationOperator: m.mutationOperator,
    reviewStatus: m.reviewStatus,
    mutationStatus: m.mutationStatus,
    reproductions: summary.total,
    reproductionSummary: {
      survived: summary.survived,
      killed: summary.killed,
      couldNotReproduce: summary.couldNotReproduce,
      consensus: summary.consensus,
    },
    contributor: m.createdBy.githubUsername,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    url: `${baseUrl}/mutants/${m.id}`,
    description: m.description,
    originalCode: m.originalCode,
    mutatedCode: m.mutatedCode,
    diff: m.gitDiff,
    duplicateOf: m.duplicateOfId,
    submissions: m.submissions.map((s) => ({
      submittedBy: s.submittedBy.githubUsername,
      buildCommand: s.buildCommand,
      testCommand: s.testCommand,
      fuzzCommand: s.fuzzCommand,
      testDurationSeconds: s.testDurationSeconds,
      environment: s.environmentDescription,
      operatingSystem: s.operatingSystem,
      compiler: s.compiler,
      observedResult: s.observedResult,
      notes: s.notes,
      createdAt: s.createdAt.toISOString(),
    })),
    validations: m.validations.map((v) => ({
      user: v.user.githubUsername,
      result: v.result,
      command: v.command,
      environment: v.environment,
      notes: v.notes,
      killingTestRef: v.killingTestRef,
      createdAt: v.createdAt.toISOString(),
    })),
    history: m.statusHistory.map((h) => ({
      kind: h.kind,
      from: h.previousValue,
      to: h.newValue,
      changedBy: h.changedBy?.githubUsername ?? null,
      comment: h.comment,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}
