/** Maps a file path to a Monaco language id. Unknown extensions fall back to plaintext. */
const BY_EXTENSION: Record<string, string> = {
  c: "c",
  h: "c",
  cc: "cpp",
  cpp: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  hh: "cpp",
  hxx: "cpp",
  inl: "cpp",
  m: "objective-c",
  mm: "objective-c",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  py: "python",
  rb: "ruby",
  php: "php",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
  ini: "ini",
  md: "markdown",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  cmake: "cmake",
  txt: "plaintext",
  sql: "sql",
  html: "html",
  css: "css",
  scss: "scss",
  xml: "xml",
  lua: "lua",
  pl: "perl",
  cs: "csharp",
  scala: "scala",
  dart: "dart",
  zig: "zig",
};

const BY_NAME: Record<string, string> = {
  makefile: "makefile",
  "cmakelists.txt": "cmake",
  dockerfile: "dockerfile",
};

export function languageForPath(path: string): string {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  if (BY_NAME[name]) return BY_NAME[name];
  const ext = name.includes(".") ? (name.split(".").pop() ?? "") : "";
  return BY_EXTENSION[ext] ?? "plaintext";
}
