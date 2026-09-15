/**
 * Metadata for the fixture repositories used when GITHUB_MODE resolves to
 * `mock`. File contents live on disk under `fixtures/repos/<owner>/<repo>/`.
 *
 * Both commits of a repository serve the same file tree: the fixtures are a
 * snapshot, and the MVP only needs two distinct SHAs to exercise the
 * "mutant refers to an older revision" behaviour.
 */
import type { CommitInfo, RepositoryInfo } from "../types";

export interface MockCommit extends Omit<CommitInfo, "date"> {
  date: Date;
}

export interface MockPullRequestFile {
  path: string;
  status: "added" | "modified";
  additions: number;
  deletions: number;
  changedRanges: Array<[number, number]>;
}

/** Fixture pull request: base = older commit, head = newer commit of the repo. */
export interface MockPullRequest {
  number: number;
  title: string;
  authorLogin: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  headRef: string;
  files: MockPullRequestFile[];
}

export interface MockRepo {
  info: RepositoryInfo;
  /** Ordered oldest -> newest; the last one is the head of the default branch. */
  commits: MockCommit[];
  pullRequests: MockPullRequest[];
}

function commit(
  owner: string,
  repo: string,
  sha: string,
  message: string,
  authorName: string,
  authorLogin: string,
  date: string,
): MockCommit {
  return {
    sha,
    message,
    authorName,
    authorLogin,
    date: new Date(date),
    htmlUrl: `https://github.com/${owner}/${repo}/commit/${sha}`,
  };
}

export const MOCK_REPOS: MockRepo[] = [
  {
    info: {
      id: "1181927",
      owner: "bitcoin",
      name: "bitcoin",
      fullName: "bitcoin/bitcoin",
      description: "Bitcoin Core integration/staging tree",
      defaultBranch: "master",
      language: "C++",
      htmlUrl: "https://github.com/bitcoin/bitcoin",
      isPrivate: false,
      isArchived: false,
    },
    commits: [
      commit(
        "bitcoin",
        "bitcoin",
        "3f0c9a7d21b64e8f5a1c2d9e7b4f6a8c0d1e2f3a",
        "script: tighten minimal push checks for small integers",
        "Maria Kowalski",
        "mkowalski",
        "2026-06-18T14:22:10Z",
      ),
      commit(
        "bitcoin",
        "bitcoin",
        "9b2e4d6f8a0c1e3b5d7f9a1c3e5b7d9f1a3c5e7b",
        "consensus: refactor legacy sigop counting and finality checks",
        "Daniel Osei",
        "dosei",
        "2026-08-21T09:05:44Z",
      ),
    ],
    pullRequests: [
      {
        number: 31842,
        title: "script: reject non-minimal pushes of 75-byte data",
        authorLogin: "maria-k",
        state: "OPEN",
        headRef: "minimal-push-boundary",
        files: [
          {
            path: "src/script/interpreter.cpp",
            status: "modified",
            additions: 6,
            deletions: 2,
            changedRanges: [
              [52, 62],
              [163, 167],
            ],
          },
          {
            path: "src/test/script_tests.cpp",
            status: "modified",
            additions: 12,
            deletions: 0,
            changedRanges: [[14, 25]],
          },
        ],
      },
    ],
  },
  {
    info: {
      id: "460588",
      owner: "curl",
      name: "curl",
      fullName: "curl/curl",
      description: "A command line tool and library for transferring data with URL syntax",
      defaultBranch: "master",
      language: "C",
      htmlUrl: "https://github.com/curl/curl",
      isPrivate: false,
      isArchived: false,
    },
    commits: [
      commit(
        "curl",
        "curl",
        "a4c7e1f9b3d5a7c9e1f3b5d7a9c1e3f5b7d9a1c3",
        "url: reject ports above 65535 in the parser",
        "Ingrid Bergqvist",
        "ibergqvist",
        "2026-06-02T07:41:03Z",
      ),
      commit(
        "curl",
        "curl",
        "e8d1c4b7a2f5e8d1c4b7a2f5e8d1c4b7a2f5e8d1",
        "parsedate: handle two-digit years consistently",
        "Tomás Rivera",
        "trivera",
        "2026-08-09T18:30:27Z",
      ),
    ],
    pullRequests: [
      {
        number: 15908,
        title: "url: validate port numbers before use",
        authorLogin: "dfandrich",
        state: "OPEN",
        headRef: "port-validation",
        files: [
          {
            path: "lib/url.c",
            status: "modified",
            additions: 9,
            deletions: 3,
            changedRanges: [
              [105, 125],
              [173, 178],
            ],
          },
          {
            path: "tests/unit/unit1300.c",
            status: "modified",
            additions: 8,
            deletions: 0,
            changedRanges: [[18, 30]],
          },
        ],
      },
      {
        number: 15890,
        title: "parsedate: handle two-digit years consistently",
        authorLogin: "bagder",
        state: "MERGED",
        headRef: "parsedate-years",
        files: [
          {
            path: "lib/parsedate.c",
            status: "modified",
            additions: 5,
            deletions: 4,
            changedRanges: [
              [115, 120],
              [144, 148],
            ],
          },
        ],
      },
    ],
  },
  {
    info: {
      id: "75821432",
      owner: "llvm",
      name: "llvm-project",
      fullName: "llvm/llvm-project",
      description:
        "The LLVM Project is a collection of modular and reusable compiler and toolchain technologies.",
      defaultBranch: "main",
      language: "C++",
      htmlUrl: "https://github.com/llvm/llvm-project",
      isPrivate: false,
      isArchived: false,
    },
    commits: [
      commit(
        "llvm",
        "llvm-project",
        "c2f8b6d4a1e9c7b5d3f1a9e7c5b3d1f9a7e5c3b1",
        "[Support] Simplify APInt::countLeadingZeros for single-word values",
        "Yuki Tanaka",
        "ytanaka",
        "2026-06-25T11:12:59Z",
      ),
      commit(
        "llvm",
        "llvm-project",
        "7d5b3a1f9e7c5b3d1f9a7e5c3b1d9f7a5e3c1b9d",
        "[Analysis] Improve isKnownNonZero for shifts with non-zero operands",
        "Priya Raman",
        "praman",
        "2026-08-28T16:48:12Z",
      ),
    ],
    pullRequests: [
      {
        number: 120455,
        title: "[APInt] Fix comparison of values with equal bit widths",
        authorLogin: "nikic",
        state: "OPEN",
        headRef: "apint-compare",
        files: [
          {
            path: "llvm/lib/Support/APInt.cpp",
            status: "modified",
            additions: 4,
            deletions: 1,
            changedRanges: [[168, 176]],
          },
          {
            path: "llvm/unittests/Support/APIntTest.cpp",
            status: "modified",
            additions: 10,
            deletions: 0,
            changedRanges: [[24, 36]],
          },
        ],
      },
    ],
  },
];

export function getMockRepo(owner: string, repo: string): MockRepo | undefined {
  const o = owner.toLowerCase();
  const r = repo.toLowerCase();
  return MOCK_REPOS.find(
    (entry) => entry.info.owner.toLowerCase() === o && entry.info.name.toLowerCase() === r,
  );
}

/** Newest commit of a fixture repository (head of its default branch). */
export function headCommit(mock: MockRepo): MockCommit {
  return mock.commits[mock.commits.length - 1];
}
