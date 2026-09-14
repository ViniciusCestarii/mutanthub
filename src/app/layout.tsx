import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppHeader } from "@/components/layout/app-header";
import { SearchShortcut } from "@/components/layout/search-shortcut";
import { getCurrentUser } from "@/server/auth/session";
import { canAccessReviewQueue } from "@/domain/auth/permissions";
import { reviewService } from "@/server/services/review-service";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "MutantHub", template: "%s · MutantHub" },
  description:
    "A collaborative platform for discovering, reproducing and investigating surviving software mutants.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const isReviewer = canAccessReviewQueue(user);
  const reviewCount = isReviewer ? await reviewService.countQueue(user) : 0;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
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
