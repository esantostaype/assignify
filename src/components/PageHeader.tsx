import type { ReactNode } from 'react'

// Cabecera unificada de página: título a la izquierda + (opcional) buscador/acciones a la
// derecha. Sticky justo debajo del Header global (top-16) con borde inferior. Úsala en cada
// vista de nivel superior (Tasks, Team, …) para que TODAS se vean igual. Settings queda
// exento porque tiene su propio layout de tabs.
//
// No es un `template.tsx` de Next a propósito: cada página necesita su propio título y su
// propio buscador (la lógica de filtrado es distinta en cada una), así que un componente
// compartido —usado en una línea por página— evita repetir el markup sin acoplar el buscador.
export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="sticky top-16 z-50 border-b border-(--color-border-default) bg-(--color-surface-header)">
      <div className="flex items-center justify-between gap-4 p-4">
        <h1 className="flex items-center gap-2 text-xl text-(--color-text-strong)">{title}</h1>
        {children != null && <div className="w-full max-w-sm">{children}</div>}
      </div>
    </div>
  )
}
