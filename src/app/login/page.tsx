"use client";

import React, { useState } from "react";
import { Button, Input, Alert } from "@/components/ui";
import { Icon, PiUser, PiLock, PiSignOut } from "@/lib/icons";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("esantos@inszoneins.com");
  const [password, setPassword] = useState("Ersa#123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await response.json();

      if (data.success) {
        // Immediate redirect without delay
        window.location.href = '/tasks';
      } else {
        setError(data.message || "Login failed");
      }
    } catch (error) {
      console.error("❌ Network error:", error);
      setError("Connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md bg-(--color-surface-card) p-10 rounded-lg">
          <Image src="/images/logo.svg" alt="Assignify" width={160} height={38} className="mx-auto mb-8" />
          {error && (
            <Alert tone="error" className="mb-4">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="flex items-center gap-2 mb-1.5 text-sm font-semibold text-(--color-text-default)">
                <Icon icon={PiUser} size={20} />
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
              <label className="flex items-center gap-2 mb-1.5 text-sm font-semibold text-(--color-text-default)">
                <Icon icon={PiLock} size={20} />
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

            <Button
              type="submit"
              fullWidth
              loading={loading}
              disabled={loading}
              startIcon={<Icon icon={PiSignOut} size={20} />}
              className="mb-4"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>
      </div>
  );
}
