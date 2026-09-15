"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import type { HeaderUser } from "./user-menu";

interface NavLinksProps {
  user: HeaderUser | null;
  isReviewer: boolean;
  reviewCount: number;
  vertical?: boolean;
  onNavigate?: () => void;
}

export function NavLinks({ user, isReviewer, reviewCount, vertical, onNavigate }: NavLinksProps) {
  const pathname = usePathname();
  const links: Array<{ href: string; label: string; badge?: number; testId?: string }> = [
    { href: routes.projects(), label: "Projects" },
    { href: routes.mutants(), label: "Mutants" },
    { href: routes.datasets(), label: "Dataset" },
  ];
  if (user) links.push({ href: routes.dashboard(), label: "Dashboard" });
  if (isReviewer)
    links.push({
      href: routes.review(),
      label: "Review",
      badge: reviewCount,
      testId: "nav-review",
    });

  return (
    <>
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            data-testid={link.testId}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              vertical && "w-full justify-start py-2",
              active
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {link.label}
            {link.badge ? (
              <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-px font-mono text-[10px] leading-4">
                {link.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </>
  );
}
