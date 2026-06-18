"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { Button, Input, Alert } from "@/components/ui";
import { Icon, PiUser, PiLock, PiSignOut } from "@/lib/icons";
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
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid email or password");
      } else {
        // Sesión creada: vamos al tablero (full reload para tomar la cookie).
        window.location.href = "/tasks";
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
        <div className="w-full max-w-md bg-(--color-surface-card) p-10 rounded-lg">
          <Logo width={160} height={38} className="mx-auto mb-8" />
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
