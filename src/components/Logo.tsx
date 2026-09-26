// Logo de Assignify que cambia según el tema SIN flash (CSS via variante `dark`):
//   - light/base → wordmark gris (logo-light.svg)
//   - dark        → wordmark blanco (logo.svg)
//   - iso         → solo el isotipo (marca), para el sidebar colapsado (un solo asset,
//                   la marca es un gradiente azul que sirve en ambos temas).
import Image from 'next/image'
import { cn } from '@/lib/cn'

interface LogoProps {
  width?: number
  height?: number
  className?: string
  /** Renderiza solo el isotipo (marca) en vez del wordmark. */
  iso?: boolean
}

export function Logo({ width = 132, height = 38, className, iso = false }: LogoProps) {
  if (iso) {
    return <Image alt="Assignify" src="/images/isotipo.svg" width={width} height={height} priority className={className} />
  }
  const common = { alt: 'Assignify', width, height, priority: true } as const
  return (
    <>
      <Image {...common} src="/images/logo-light.svg" className={cn('block dark:hidden', className)} />
      <Image {...common} src="/images/logo.svg" className={cn('hidden dark:block', className)} />
    </>
  )
}
