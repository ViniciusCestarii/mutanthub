import Link from "next/link";
import { CornerLeftUp, File, Folder, FolderOpen } from "lucide-react";
import { routes } from "@/lib/routes";
import { EmptyState } from "@/components/shared/empty-state";
import type { TreeEntry } from "./types";

interface DirectoryListingProps {
  owner: string;
  repo: string;
  gitRef: string;
  pr?: number;
  path: string;
  entries: TreeEntry[];
}

function formatSize(size: number | null): string {
  if (size == null) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** Compact table of a directory's contents. */
export function DirectoryListing({
  owner,
  repo,
  gitRef,
  pr,
  path,
  entries,
}: DirectoryListingProps) {
  const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  if (entries.length === 0) {
    return <EmptyState icon={FolderOpen} title="Empty directory" compact className="m-4" />;
  }
  return (
    <div className="p-4" data-testid="directory-listing">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-left text-[11px] tracking-wide uppercase">
          <tr>
            <th className="py-1.5 pr-3 font-medium">Name</th>
            <th className="py-1.5 pr-3 font-medium">Type</th>
            <th className="py-1.5 text-right font-medium">Size</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {path ? (
            <tr>
              <td colSpan={3} className="py-1.5">
                <Link
                  href={routes.projectCode(owner, repo, parent || undefined, { ref: gitRef, pr })}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 font-mono text-xs hover:underline"
                >
                  <CornerLeftUp className="size-3.5" aria-hidden /> ..
                </Link>
              </td>
            </tr>
          ) : null}
          {entries.map((entry) => (
            <tr key={entry.path} className="hover:bg-muted/40">
              <td className="py-1.5 pr-3">
                <Link
                  href={routes.projectCode(owner, repo, entry.path, { ref: gitRef, pr })}
                  className="inline-flex items-center gap-1.5 font-mono text-xs hover:underline"
                >
                  {entry.type === "dir" ? (
                    <Folder className="size-3.5 text-sky-600 dark:text-sky-400" aria-hidden />
                  ) : (
                    <File className="text-muted-foreground size-3.5" aria-hidden />
                  )}
                  {entry.name}
                </Link>
              </td>
              <td className="text-muted-foreground py-1.5 pr-3 text-xs">{entry.type}</td>
              <td className="text-muted-foreground py-1.5 text-right font-mono text-xs tabular-nums">
                {formatSize(entry.size)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
