'use client'
// Login PROPIO de Hugeicons — independiente del login principal (Auth.js). Verifica
// username/password contra el .env vía /api/hugeicons/login, que setea una cookie de sesión
// que el middleware valida para dejar entrar a /hugeicons.
import React, { useState } from 'react'
import { Button, Input, Alert } from '@/components/ui'
import { Icon, PiUser, PiLock, PiSignOut } from '@/lib/icons'
import { HugeiconsLogo } from '@/components/HugeiconsLogo'

export default function HugeiconsLoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/hugeicons/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        // Full reload para que el middleware tome la cookie recién seteada.
        window.location.href = '/hugeicons'
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Invalid username or password')
      }
    } catch {
      setError('Connection failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg bg-(--color-surface-card) p-10">
        <div className="mb-8 flex justify-center">
          <HugeiconsLogo />
        </div>
        {error && (
          <Alert tone="error" className="mb-4">
            {error}
          </Alert>
        )}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-(--color-text-default)">
              <Icon icon={PiUser} size={20} />
              Username
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              disabled={loading}
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="mb-8">
            <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-(--color-text-default)">
              <Icon icon={PiLock} size={20} />
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
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
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  )
}
