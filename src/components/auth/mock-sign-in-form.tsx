"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mockSignInAction } from "@/server/actions/auth-actions";
import { cn } from "@/lib/utils";

interface MockUser {
  username: string;
  displayName: string;
  role: string;
}

export function MockSignInForm({ users, callbackUrl }: { users: MockUser[]; callbackUrl: string }) {
  const [username, setUsername] = useState(users[0]?.username ?? "");
  return (
    <form action={mockSignInAction} className="mt-4 space-y-4" data-testid="mock-sign-in-form">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      {users.length ? (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {users.map((u) => (
            <button
              key={u.username}
              type="button"
              onClick={() => setUsername(u.username)}
              data-testid={`mock-user-${u.username}`}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                username === u.username
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted",
              )}
            >
              <div className="font-mono font-medium">@{u.username}</div>
              <div className="text-muted-foreground truncate">{u.role}</div>
            </button>
          ))}
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="mock-username">Username</Label>
        <Input
          id="mock-username"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="octocat"
          autoComplete="off"
          pattern="[A-Za-z0-9\-]{1,39}"
          required
        />
      </div>
      <Button type="submit" variant="outline" className="w-full" data-testid="mock-sign-in-submit">
        Sign in as @{username || "…"}
      </Button>
    </form>
  );
}
