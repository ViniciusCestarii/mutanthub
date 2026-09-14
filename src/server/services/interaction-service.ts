import "server-only";
import type { Principal } from "@/domain/auth/permissions";
import { canComment, canEditComment, canValidateMutant } from "@/domain/auth/permissions";
import { forbidden, notFound, validationError } from "@/lib/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/server/infra/rate-limit";
import { createCommentSchema, createValidationSchema, fieldErrors } from "@/lib/validation/schemas";
import { LIMITS } from "@/lib/validation/limits";
import {
  commentRepository,
  validationRepository,
} from "@/server/repositories/interaction-repository";
import { mutantRepository } from "@/server/repositories/mutant-repository";

/** Validations (reproductions) and comments. */
export const interactionService = {
  async addValidation(principal: Principal | null, rawInput: unknown) {
    if (!principal || !canValidateMutant(principal))
      throw forbidden("Sign in to record a reproduction");
    const parsed = createValidationSchema.safeParse(rawInput);
    if (!parsed.success)
      throw validationError("Please fix the highlighted fields", fieldErrors(parsed.error));
    const input = parsed.data;

    const mutant = await mutantRepository.findListItem(input.mutantId);
    if (!mutant) throw notFound("Mutant");
    await enforceRateLimit({
      ...RATE_LIMITS.validation,
      action: "validation",
      subject: principal.id,
    });

    return validationRepository.create({
      mutantId: mutant.id,
      projectId: mutant.project.id,
      userId: principal.id,
      result: input.result,
      command: input.command ?? null,
      environment: input.environment ?? null,
      notes: input.notes ?? null,
      killingTestRef: input.killingTestRef ?? null,
    });
  },

  async addComment(principal: Principal | null, rawInput: unknown) {
    if (!principal || !canComment(principal)) throw forbidden("Sign in to comment");
    const parsed = createCommentSchema.safeParse(rawInput);
    if (!parsed.success)
      throw validationError("Please fix the highlighted fields", fieldErrors(parsed.error));
    const input = parsed.data;

    const mutant = await mutantRepository.findListItem(input.mutantId);
    if (!mutant) throw notFound("Mutant");
    await enforceRateLimit({ ...RATE_LIMITS.comment, action: "comment", subject: principal.id });

    return commentRepository.create({
      mutantId: mutant.id,
      projectId: mutant.project.id,
      userId: principal.id,
      body: input.body,
    });
  },

  async editComment(principal: Principal | null, commentId: string, body: string) {
    if (!principal) throw forbidden("Sign in to continue");
    const comment = await commentRepository.findById(commentId);
    if (!comment) throw notFound("Comment");
    if (!canEditComment(principal, comment, comment.mutant.projectId)) throw forbidden();
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > LIMITS.comment)
      throw validationError("Comment must be between 1 and 10000 characters");
    return commentRepository.update(commentId, trimmed);
  },

  async deleteComment(principal: Principal | null, commentId: string) {
    if (!principal) throw forbidden("Sign in to continue");
    const comment = await commentRepository.findById(commentId);
    if (!comment) throw notFound("Comment");
    if (!canEditComment(principal, comment, comment.mutant.projectId)) throw forbidden();
    return commentRepository.delete(commentId);
  },
};
