"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonacoDiff } from "@/components/code/monaco-diff";

interface DiffTabsProps {
  original: string;
  modified: string;
  language: string;
  height: number;
}

export function DiffTabs({ original, modified, language, height }: DiffTabsProps) {
  const [view, setView] = useState("side-by-side");
  return (
    <Tabs value={view} onValueChange={setView}>
      <TabsList>
        <TabsTrigger value="side-by-side">Side by side</TabsTrigger>
        <TabsTrigger value="unified">Unified</TabsTrigger>
      </TabsList>
      <MonacoDiff
        original={original}
        modified={modified}
        language={language}
        height={height}
        inline={view === "unified"}
        resizable
        className="border-border mt-2 overflow-hidden rounded-md border"
      />
    </Tabs>
  );
}
