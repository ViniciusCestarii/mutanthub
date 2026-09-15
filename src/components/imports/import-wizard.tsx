"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { routes } from "@/lib/routes";

interface RowIssue {
  index: number;
  message: string;
  existingId?: number;
}

interface Report {
  toolName: string;
  toolVersion: string | null;
  fileName: string | null;
  total: number;
  valid: number;
  errors: RowIssue[];
  duplicates: RowIssue[];
  commits: string[];
}

interface Done {
  batchId: string;
  created: number;
}

/** Two-step upload: dry run with a full report, then a confirmed import. */
export function ImportWizard({ owner, repo }: { owner: string; repo: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [toolName, setToolName] = useState("");
  const [toolVersion, setToolVersion] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"dry-run" | "commit" | null>(null);

  async function send(mode: "dry-run" | "commit") {
    if (!file) return;
    setBusy(mode);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("mode", mode);
      if (toolName) body.set("toolName", toolName);
      if (toolVersion) body.set("toolVersion", toolVersion);
      const res = await fetch(routes.projectImportApi(owner, repo), { method: "POST", body });
      const data = (await res.json()) as {
        error?: string;
        report?: Report;
        batchId?: string;
        created?: number;
      };
      if (!res.ok) {
        setError(data.error ?? "Import failed");
        return;
      }
      if (mode === "dry-run" && data.report) {
        setReport(data.report);
        setDone(null);
      } else if (data.batchId) {
        setDone({ batchId: data.batchId, created: data.created ?? 0 });
        setReport(data.report ?? null);
        toast.success(`${data.created ?? 0} mutants imported`);
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4" data-testid="import-wizard">
      <div className="grid gap-3 sm:grid-cols-[1fr_160px_120px]">
        <div className="space-y-1">
          <Label htmlFor="import-file" className="text-xs">
            Mutants file (.json or .jsonl)
          </Label>
          <Input
            id="import-file"
            type="file"
            accept=".json,.jsonl,application/json"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setReport(null);
              setDone(null);
              setError(null);
            }}
            data-testid="import-file"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="import-tool" className="text-xs">
            Tool (overrides the file)
          </Label>
          <Input
            id="import-tool"
            value={toolName}
            onChange={(e) => setToolName(e.target.value)}
            placeholder="mull"
            data-testid="import-tool"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="import-version" className="text-xs">
            Version
          </Label>
          <Input
            id="import-version"
            value={toolVersion}
            onChange={(e) => setToolVersion(e.target.value)}
            placeholder="0.24.0"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!file || busy !== null}
          onClick={() => void send("dry-run")}
          data-testid="import-dry-run"
        >
          {busy === "dry-run" ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <FileUp className="size-3.5" aria-hidden />
          )}
          Check file
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!file || !report || report.valid === 0 || busy !== null || done !== null}
          onClick={() => void send("commit")}
          data-testid="import-commit"
        >
          {busy === "commit" ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-3.5" aria-hidden />
          )}
          {report
            ? `Import ${report.valid} mutant${report.valid === 1 ? "" : "s"} as approved`
            : "Import"}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive" data-testid="import-error">
          <AlertTitle>Could not process the file</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {done ? (
        <Alert data-testid="import-done">
          <CheckCircle2 className="size-4" aria-hidden />
          <AlertTitle>{done.created} mutants imported</AlertTitle>
          <AlertDescription>
            <Link
              href={`${routes.projectMutants(owner, repo)}?batch=${done.batchId}`}
              className="underline"
              data-testid="import-view-link"
            >
              View the imported mutants
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {report ? (
        <div className="space-y-3" data-testid="import-report">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Stat label="Rows" value={report.total} />
            <Stat label="Ready to import" value={report.valid} tone="success" />
            <Stat label="Duplicates skipped" value={report.duplicates.length} tone="muted" />
            <Stat
              label="Errors"
              value={report.errors.length}
              tone={report.errors.length ? "danger" : "muted"}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Tool:{" "}
            <span className="font-mono">
              {report.toolName}
              {report.toolVersion ? ` ${report.toolVersion}` : ""}
            </span>
            {report.commits.length ? (
              <>
                {" "}
                · commits:{" "}
                <span className="font-mono">
                  {report.commits.map((c) => c.slice(0, 7)).join(", ")}
                </span>
              </>
            ) : null}
          </p>
          {report.errors.length > 0 ? (
            <IssueList
              title="Rows with errors (not imported)"
              issues={report.errors}
              testId="import-errors"
            />
          ) : null}
          {report.duplicates.length > 0 ? (
            <IssueList
              title="Duplicates (skipped)"
              issues={report.duplicates}
              testId="import-duplicates"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "muted" | "danger";
}) {
  const color =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "danger"
        ? "text-rose-600 dark:text-rose-400"
        : tone === "muted"
          ? "text-muted-foreground"
          : "";
  return (
    <div className="border-border rounded-md border px-3 py-2">
      <div className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</div>
      <div className={`font-mono text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function IssueList({
  title,
  issues,
  testId,
}: {
  title: string;
  issues: RowIssue[];
  testId: string;
}) {
  return (
    <details open={issues.length <= 20} data-testid={testId}>
      <summary className="cursor-pointer text-xs font-medium">
        {title} ({issues.length})
      </summary>
      <ul className="mt-1 max-h-64 space-y-0.5 overflow-y-auto font-mono text-[11px]">
        {issues.slice(0, 500).map((issue) => (
          <li key={`${issue.index}-${issue.message}`}>
            row {issue.index + 1}: {issue.message}
            {issue.existingId ? (
              <>
                {" "}
                <Link href={routes.mutant(issue.existingId)} className="underline">
                  #{issue.existingId}
                </Link>
              </>
            ) : null}
          </li>
        ))}
        {issues.length > 500 ? <li>... {issues.length - 500} more</li> : null}
      </ul>
    </details>
  );
}
