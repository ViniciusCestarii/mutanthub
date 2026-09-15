/** Central place for building internal URLs so route changes stay in one file. */
export const routes = {
  home: () => "/",
  dashboard: () => "/dashboard",
  projects: () => "/projects",
  project: (owner: string, repo: string) => `/projects/${owner}/${repo}`,
  projectCode: (
    owner: string,
    repo: string,
    path?: string,
    opts?: { ref?: string; line?: number },
  ) => {
    const base = `/projects/${owner}/${repo}/code${path ? `/${path}` : ""}`;
    const params = new URLSearchParams();
    if (opts?.ref) params.set("ref", opts.ref);
    const query = params.toString();
    const hash = opts?.line ? `#L${opts.line}` : "";
    return `${base}${query ? `?${query}` : ""}${hash}`;
  },
  projectMutants: (owner: string, repo: string) => `/projects/${owner}/${repo}/mutants`,
  projectSettings: (owner: string, repo: string) => `/projects/${owner}/${repo}/settings`,
  mutants: () => "/mutants",
  mutant: (id: number) => `/mutants/${id}`,
  mutantEdit: (id: number) => `/mutants/${id}/edit`,
  review: () => "/review",
  reviewItem: (id: number) => `/review?selected=${id}`,
  user: (username: string) => `/users/${username}`,
  settings: () => "/settings",
  notifications: () => "/notifications",
  search: (q: string) => `/search?q=${encodeURIComponent(q)}`,
  signIn: (callbackUrl?: string) =>
    `/signin${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`,
  apiDocs: () => "/api/docs",
  github: {
    repo: (owner: string, repo: string) => `https://github.com/${owner}/${repo}`,
    commit: (owner: string, repo: string, sha: string) =>
      `https://github.com/${owner}/${repo}/commit/${sha}`,
    file: (owner: string, repo: string, sha: string, path: string, line?: number) =>
      `https://github.com/${owner}/${repo}/blob/${sha}/${path}${line ? `#L${line}` : ""}`,
    user: (username: string) => `https://github.com/${username}`,
  },
};
