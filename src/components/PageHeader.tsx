import type { ReactNode } from 'react'

// Cabecera unificada de página (base: el header de Reports): título + descripción
// debajo a la izquierda, y a la derecha todos los selects/filtros/acciones. Sticky
// arriba del content, sin borde (mismo surface-app). Úsala en TODAS las vistas.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  /** Texto secundario debajo del título. */
  description?: ReactNode
  /** Selects, filtros, botones — se alinean a la derecha. */
  actions?: ReactNode
}) {
  return (
    <div className="sticky top-0 z-30 bg-(--color-surface-app)">
      <div className="flex flex-col gap-3 px-4 py-4 md:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-(--color-text-strong)">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
