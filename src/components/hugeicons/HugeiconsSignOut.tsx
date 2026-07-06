'use client'
// Logout del login PROPIO de Hugeicons: borra la cookie de sesión (vía /api/hugeicons/logout)
// y vuelve a la pantalla de login. No toca la sesión de Auth.js de la app principal.
import { Button } from '@/components/ui'
import { Icon, PiSignOut } from '@/lib/icons'

export function HugeiconsSignOut() {
  const signOut = async () => {
    await fetch('/api/hugeicons/logout', { method: 'POST' }).catch(() => {})
    window.location.href = '/hugeicons/login'
  }
  return (
    <Button
      size="sm"
      variant="soft"
      color="neutral"
      startIcon={<Icon icon={PiSignOut} size={16} />}
      onClick={signOut}
    >
      Sign out
    </Button>
  )
}
