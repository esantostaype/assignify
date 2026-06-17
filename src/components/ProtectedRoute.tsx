// src/components/ProtectedRoute.tsx - VERSIÓN OPTIMIZADA
'use client'

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui'
import { Typography } from '@/components/ui/typography'

interface ProtectedRouteProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

const screenStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      fallback || (
        <div
          className="flex flex-col items-center justify-center min-h-screen gap-4"
          style={screenStyle}
        >
          <Spinner size={36} colorClassName="text-white" />
          <Typography variant="body" color="white">
            Verifying authentication...
          </Typography>
        </div>
      )
    )
  }

  // Si no está autenticado, el middleware se encargará de la redirección
  // Pero mostramos un mensaje por si acaso
  if (!user) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen gap-4"
        style={screenStyle}
      >
        <Typography variant="h4" color="white">
          Access Denied
        </Typography>
        <Typography variant="body" color="white">
          Redirecting to login...
        </Typography>
        <Spinner size={24} colorClassName="text-white" />
      </div>
    )
  }

  // Usuario autenticado, mostrar contenido
  return <>{children}</>
}

// Hook personalizado optimizado
export function useRequireAuth() {
  const { user, loading } = useAuth()

  return {
    user,
    loading,
    isAuthenticated: !!user && !loading,
    isUnauthenticated: !user && !loading
  }
}
