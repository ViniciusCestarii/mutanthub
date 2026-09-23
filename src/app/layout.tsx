import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ThemeBootstrap } from "@/components/layout/theme-bootstrap";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppHeader } from "@/components/layout/app-header";
import { SearchShortcut } from "@/components/layout/search-shortcut";
import { getCurrentUser } from "@/server/auth/session";
import { canAccessReviewQueue } from "@/domain/auth/permissions";
import { reviewService } from "@/server/services/review-service";
import { notificationService } from "@/server/services/notification-service";
import { relativeTime } from "@/lib/format";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "MutantHub", template: "%s · MutantHub" },
  description:
    "A collaborative platform for discovering, reproducing and investigating surviving software mutants. Use whichever mutation testing tool you want.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Per-request CSP nonce from src/proxy.ts, applied to the inline theme bootstrap script.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const isReviewer = canAccessReviewQueue(user);
  const [reviewCount, notifications] = await Promise.all([
    isReviewer ? reviewService.countQueue(user) : Promise.resolve(0),
    notificationService.getSummary(user),
  ]);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <ThemeBootstrap nonce={nonce} />
      </head>
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>
            <AppHeader
              user={
                user
                  ? {
                      githubUsername: user.githubUsername,
                      displayName: user.displayName,
                      avatarUrl: user.avatarUrl,
                      isAdmin: user.globalRole === "ADMIN",
                    }
                  : null
              }
              isReviewer={isReviewer}
              reviewCount={reviewCount}
              notifications={{
                unread: notifications.unread,
                latest: notifications.latest.map((n) => ({
                  id: n.id,
                  title: n.title,
                  body: n.body,
                  read: Boolean(n.readAt),
                  createdAtLabel: relativeTime(n.createdAt),
                  actor: n.actor
                    ? { githubUsername: n.actor.githubUsername, avatarUrl: n.actor.avatarUrl }
                    : null,
                })),
              }}
            />
            <div className="flex flex-1 flex-col">{children}</div>
            <Toaster position="bottom-right" richColors closeButton />
            <SearchShortcut />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
