"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon, LockIcon, Login03Icon } from "@hugeicons/core-free-icons";
import { Input } from "@/components/shadcn/input";
import { Button } from "@/components/shadcn/button";
import { Alert } from "@/components/shadcn/alert";
import { Spinner } from "@/components/shadcn/spinner";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setError("Invalid email or password");
      } else {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("❌ Login error:", error);
      setError("Connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg bg-(--color-surface-card) p-10">
        <Logo width={160} height={38} className="mx-auto mb-8" />
        {error && (
          <Alert tone="error" className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-foreground">
              <HugeiconsIcon icon={Mail01Icon} size={20} />
              Email
            </label>
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="mb-8">
            <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-foreground">
              <HugeiconsIcon icon={LockIcon} size={20} />
              Password
            </label>
            <Input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" className="mb-4 w-full" disabled={loading}>
            {loading ? <Spinner /> : <HugeiconsIcon icon={Login03Icon} size={20} />}
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        {/* [SaaS v2] Login con ClickUp OAuth. */}
        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-(--color-border-default)" />
          or
          <span className="h-px flex-1 bg-(--color-border-default)" />
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={loading}
          onClick={() => signIn("clickup", { callbackUrl: "/" })}
        >
          Continue with ClickUp
        </Button>
      </div>
    </div>
  );
}
