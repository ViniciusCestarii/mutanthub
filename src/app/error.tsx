"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16">
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong"
        description={
          error.digest
            ? `Error reference: ${error.digest}`
            : "An unexpected error occurred while rendering this page."
        }
        action={
          <Button variant="outline" size="sm" onClick={reset}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
