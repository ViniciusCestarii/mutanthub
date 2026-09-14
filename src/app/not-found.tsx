import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { routes } from "@/lib/routes";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16">
      <EmptyState
        icon={FileQuestion}
        title="Page not found"
        description="The page you are looking for does not exist or was moved."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={routes.home()}>Back to home</Link>
          </Button>
        }
      />
    </main>
  );
}
