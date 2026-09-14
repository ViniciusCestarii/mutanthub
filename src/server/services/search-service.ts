import "server-only";
import { LIMITS } from "@/lib/validation/limits";
import { mutantRepository, type MutantListItem } from "@/server/repositories/mutant-repository";
import { projectRepository, type ProjectSummary } from "@/server/repositories/project-repository";
import { userRepository, type UserSummary } from "@/server/repositories/user-repository";
import {
  mutationOperatorSchema,
  mutationStatusSchema,
  reviewStatusSchema,
} from "@/lib/validation/schemas";

export interface SearchResults {
  query: string;
  projects: ProjectSummary[];
  users: UserSummary[];
  mutants: MutantListItem[];
  mutantTotal: number;
  /** A direct hit on a mutant id, when the query is "#123" or "123". */
  mutantById: MutantListItem | null;
  interpretedAs: string[];
}

/**
 * Global search. Interprets the query in several ways at once (id, status,
 * operator, username, repository, path or code snippet) and merges results.
 */
export const searchService = {
  async search(rawQuery: string): Promise<SearchResults> {
    const query = rawQuery.trim().slice(0, LIMITS.searchQuery);
    const empty: SearchResults = {
      query,
      projects: [],
      users: [],
      mutants: [],
      mutantTotal: 0,
      mutantById: null,
      interpretedAs: [],
    };
    if (query.length < 1) return empty;

    const interpretedAs: string[] = [];
    const idMatch = query.match(/^#?(\d{1,9})$/);
    const upper = query.toUpperCase().replace(/[\s-]+/g, "_");
    const asOperator = mutationOperatorSchema.safeParse(upper);
    const asReview = reviewStatusSchema.safeParse(upper);
    const asMutation = mutationStatusSchema.safeParse(upper);
    const asUser = query.startsWith("@") ? query.slice(1) : null;

    const [mutantById, projects, users, byOperator, byReview, byMutation, byUser, byText] =
      await Promise.all([
        idMatch ? mutantRepository.findListItem(Number(idMatch[1])) : Promise.resolve(null),
        projectRepository.search(query, 5),
        userRepository.searchByUsername(asUser ?? query, 5),
        asOperator.success
          ? mutantRepository.list({ mutationOperator: asOperator.data }, { page: 1, pageSize: 10 })
          : Promise.resolve(null),
        asReview.success
          ? mutantRepository.list({ reviewStatus: asReview.data }, { page: 1, pageSize: 10 })
          : Promise.resolve(null),
        asMutation.success
          ? mutantRepository.list({ mutationStatus: asMutation.data }, { page: 1, pageSize: 10 })
          : Promise.resolve(null),
        asUser
          ? mutantRepository.list({ createdByUsername: asUser }, { page: 1, pageSize: 10 })
          : Promise.resolve(null),
        mutantRepository.list({ text: query }, { page: 1, pageSize: 20 }),
      ]);

    if (mutantById) interpretedAs.push("mutant id");
    if (asOperator.success) interpretedAs.push("mutation operator");
    if (asReview.success) interpretedAs.push("review status");
    if (asMutation.success) interpretedAs.push("mutation status");
    if (asUser) interpretedAs.push("username");
    if (projects.length) interpretedAs.push("repository");
    interpretedAs.push("file path or code snippet");

    const merged = new Map<number, MutantListItem>();
    for (const list of [byOperator, byReview, byMutation, byUser, byText]) {
      for (const item of list?.items ?? []) merged.set(item.id, item);
    }
    const total = Math.max(
      byText.total,
      byOperator?.total ?? 0,
      byReview?.total ?? 0,
      byMutation?.total ?? 0,
      byUser?.total ?? 0,
    );

    return {
      query,
      projects,
      users,
      mutants: [...merged.values()].slice(0, 25),
      mutantTotal: total,
      mutantById,
      interpretedAs,
    };
  },
};
