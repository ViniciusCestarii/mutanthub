"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NavLinks } from "./nav-links";
import type { HeaderUser } from "./user-menu";

interface MobileNavProps {
  user: HeaderUser | null;
  isReviewer: boolean;
  reviewCount: number;
}

export function MobileNav(props: MobileNavProps) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Open navigation">
          <Menu className="size-4" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-2" aria-label="Main">
          <NavLinks {...props} vertical onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
