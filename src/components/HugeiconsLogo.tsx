// Wordmark de Hugeicons (dentro de Assignify) que cambia según el tema SIN
// flash (CSS via variante `dark`) — mismo patrón que `Logo`:
//   - light/base → wordmark oscuro (logo-hugeicons-black.svg)
//   - dark        → wordmark blanco (logo-hugeicons-white.svg)
import Image from 'next/image'
import { cn } from '@/lib/cn'

interface HugeiconsLogoProps {
  width?: number
  height?: number
  className?: string
}

export function HugeiconsLogo({ width = 120, height = 22, className }: HugeiconsLogoProps) {
  const common = { alt: 'Hugeicons', width, height, priority: true } as const
  return (
    <>
      <Image {...common} src="/images/logo-hugeicons-black.svg" className={cn('block dark:hidden', className)} />
      <Image {...common} src="/images/logo-hugeicons-white.svg" className={cn('hidden dark:block', className)} />
    </>
  )
}
