'use client'
// src/components/designers/TeamWorkload.tsx
// Vista "de un vistazo" de la carga y disponibilidad de cada diseñador.
import React from 'react'
import { Card, Chip, Progress, Avatar, Tooltip } from '@/components/ui'
import { Icon, PiCalendarBlank, PiClock, PiCheckCircle, PiSparkle } from '@/lib/icons'
import { useUsersWorkload, type UserWorkload, type WorkloadStatus } from '@/hooks/queries/useWorkload'

const STATUS: Record<WorkloadStatus, { label: string; color: 'success' | 'primary' | 'error' | 'warning' }> = {
  available: { label: 'Disponible', color: 'success' },
  busy: { label: 'Con carga', color: 'primary' },
  overloaded: { label: 'Sobrecargado', color: 'error' },
  on_vacation: { label: 'De vacaciones', color: 'warning' },
}

// Días de carga que se consideran "lleno" (100% de la barra).
const MAX_LOAD_DAYS = 15

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
}

function initialsOf(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function WorkloadCard({ u }: { u: UserWorkload }) {
  const st = STATUS[u.status]
  const loadPct = Math.min(100, Math.round((u.totalDurationDays / MAX_LOAD_DAYS) * 100))
  const barColor =
    u.status === 'overloaded' ? 'error' : u.status === 'on_vacation' ? 'warning' : u.totalDurationDays >= 3 ? 'primary' : 'success'

  return (
    <Card variant="outlined" padding="md" className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar className="!h-11 !w-11">{initialsOf(u.name)}</Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-semibold text-(--color-text-strong)">{u.name}</p>
            {u.isSpecialist && (
              <Tooltip content="Especialista">
                <span className="inline-flex">
                  <Icon icon={PiSparkle} size={14} className="text-primary-500" />
                </span>
              </Tooltip>
            )}
          </div>
          <p className="truncate text-xs text-(--color-text-muted)">{u.roles.join(' · ') || 'Sin rol'}</p>
        </div>
        <Chip color={st.color} variant="soft" size="sm">
          {st.label}
        </Chip>
      </div>

      {/* Barra de carga */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-(--color-text-muted)">
          <span>Carga</span>
          <span className="font-medium text-(--color-text-default)">
            {u.totalDurationDays}d · {u.taskCount} {u.taskCount === 1 ? 'tarea' : 'tareas'}
          </span>
        </div>
        <Progress value={loadPct} color={barColor} />
      </div>

      {/* Disponibilidad / vacaciones */}
      <div className="flex flex-col gap-1 text-xs">
        {u.status === 'on_vacation' && u.currentVacation ? (
          <div className="flex items-center gap-1.5 text-warning-600">
            <Icon icon={PiCalendarBlank} size={14} />
            De vacaciones hasta {fmtDate(u.currentVacation.endDate)}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-(--color-text-muted)">
            <Icon icon={u.taskCount === 0 ? PiCheckCircle : PiClock} size={14} />
            {u.taskCount === 0 ? 'Libre ahora' : `Se libera el ${fmtDate(u.availableFrom)}`}
          </div>
        )}
        {u.upcomingVacations.length > 0 && (
          <div className="flex items-center gap-1.5 text-(--color-text-subtle)">
            <Icon icon={PiCalendarBlank} size={14} />
            Próx. vacaciones: {fmtDate(u.upcomingVacations[0].startDate)} – {fmtDate(u.upcomingVacations[0].endDate)}
          </div>
        )}
      </div>
    </Card>
  )
}

export function TeamWorkload() {
  const { data: workload = [], isLoading } = useUsersWorkload()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-36 rounded-lg skeleton-shimmer" />
        ))}
      </div>
    )
  }

  if (workload.length === 0) return null

  // Disponibles primero (menor carga); el orden ayuda a ver de un vistazo quién puede tomar trabajo.
  const sorted = [...workload].sort((a, b) => a.totalDurationDays - b.totalDurationDays)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sorted.map((u) => (
        <WorkloadCard key={u.id} u={u} />
      ))}
    </div>
  )
}
