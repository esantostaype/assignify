// Logo de Assignify que cambia según el tema SIN flash (CSS via variante `dark`):
//   - light/base → wordmark gris (logo-light.svg)
//   - dark        → wordmark blanco (logo.svg)
import Image from 'next/image'
import { cn } from '@/lib/cn'

interface LogoProps {
  width?: number
  height?: number
  className?: string
}

export function Logo({ width = 132, height = 38, className }: LogoProps) {
  const common = { alt: 'Assignify', width, height, priority: true } as const
  return (
    <>
      <Image {...common} src="/images/logo-light.svg" className={cn('block dark:hidden', className)} />
      <Image {...common} src="/images/logo.svg" className={cn('hidden dark:block', className)} />
    </>
  )
}
