'use client'
// src/components/designers/SyncedDesignerCard.tsx
// Tarjeta COMPLETA de un diseñador sincronizado: fusiona la identidad
// (foto, nombre, roles, email, botón editar) con su carga de trabajo
// (barra, "Se libera el…", "N en aprobación", vacaciones).
import React from 'react'
import { Card, Chip, Progress, Avatar, Tooltip, Skeleton } from '@/components/ui'
import {
  Icon,
  PiCalendarBlank,
  PiClock,
  PiCheckCircle,
  PiSparkle,
  PiArrowsClockwise,
  PiEnvelope,
  PiPencilSimple,
} from '@/lib/icons'
import { IconButton } from '@/components/ui'
import type { UserWorkload, WorkloadStatus } from '@/hooks/queries/useWorkload'

// Estado de carga: labels y colores (compartidos con la vista de "carga del equipo").
const STATUS: Record<WorkloadStatus, { label: string; color: 'success' | 'primary' | 'error' | 'warning' }> = {
  available: { label: 'Disponible', color: 'success' },
  busy: { label: 'Con carga', color: 'primary' },
  overloaded: { label: 'Sobrecargado', color: 'error' },
  on_vacation: { label: 'De vacaciones', color: 'warning' },
}

// Horizonte (días) que llena la barra al 100%: el umbral de "sobrecargado".
const HORIZON_DAYS = 14

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
}

export interface DesignerUser {
  clickupId: string
  name: string
  email: string
  profilePicture: string
  initials: string
  color: string
  existsInLocal: boolean
  canSync: boolean
  lastActive?: string
}

interface SyncedDesignerCardProps {
  user: DesignerUser
  /** Carga de trabajo cruzada por id (workload.id === user.clickupId). */
  workload?: UserWorkload
  /** True mientras la query de carga está cargando (muestra esqueleto de carga). */
  workloadLoading?: boolean
  onEdit?: () => void
}

export const SyncedDesignerCard: React.FC<SyncedDesignerCardProps> = ({
  user,
  workload,
  workloadLoading = false,
  onEdit,
}) => {
  const roles = workload?.roles ?? []
  const st = workload ? STATUS[workload.status] : null

  // La barra representa cuán lejos está su fecha de disponibilidad (0 = libre hoy,
  // 100% = a 2 semanas o más → sobrecargado).
  const loadPct = workload
    ? Math.min(100, Math.round((workload.availableInDays / HORIZON_DAYS) * 100))
    : 0
  const barColor =
    workload?.status === 'overloaded'
      ? 'error'
      : workload?.status === 'on_vacation'
        ? 'warning'
        : workload?.status === 'busy'
          ? 'primary'
          : 'success'

  return (
    <Card variant="outlined" padding="md" className="flex flex-col gap-3">
      {/* Cabecera: identidad + estado + editar */}
      <div className="flex items-start gap-3">
        <Avatar
          src={user.profilePicture}
          className="!h-11 !w-11"
          style={user.color ? { backgroundColor: user.color } : undefined}
        >
          {user.initials}
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-semibold text-(--color-text-strong)">{user.name}</p>
            {workload?.isSpecialist && (
              <Tooltip content="Especialista">
                <span className="inline-flex">
                  <Icon icon={PiSparkle} size={14} className="text-primary-500" />
                </span>
              </Tooltip>
            )}
          </div>
          <p className="truncate text-xs text-(--color-text-muted)">
            {roles.length > 0 ? roles.join(' · ') : 'Sin rol'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {st && (
            <Chip color={st.color} variant="soft" size="sm">
              {st.label}
            </Chip>
          )}
          {onEdit && (
            <IconButton
              aria-label="Edit user"
              size="sm"
              variant="soft"
              color="primary"
              onClick={onEdit}
            >
              <Icon icon={PiPencilSimple} size={16} />
            </IconButton>
          )}
        </div>
      </div>

      {/* Email */}
      <div className="flex items-center gap-1.5 text-xs text-(--color-text-muted)">
        <Icon icon={PiEnvelope} size={14} />
        <span className="truncate">{user.email}</span>
      </div>

      {workloadLoading || !workload ? (
        // Carga aún no disponible → esqueleto sin romper el layout.
        <div className="flex flex-col gap-2">
          <Skeleton variant="rect" height={8} className="rounded-full" />
          <Skeleton variant="text" width="50%" />
        </div>
      ) : (
        <>
          {/* Barra de carga (tareas pendientes: TO_DO / En progreso) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs text-(--color-text-muted)">
              <span>Carga</span>
              <span className="font-medium text-(--color-text-default)">
                {workload.taskCount} {workload.taskCount === 1 ? 'tarea pendiente' : 'tareas pendientes'}
              </span>
            </div>
            <Progress value={loadPct} color={barColor} />
          </div>

          {/* Disponibilidad / vacaciones */}
          <div className="flex flex-col gap-1 text-xs">
            {workload.status === 'on_vacation' && workload.currentVacation ? (
              <div className="flex items-center gap-1.5 text-warning-600">
                <Icon icon={PiCalendarBlank} size={14} />
                De vacaciones hasta {fmtDate(workload.currentVacation.endDate)}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-(--color-text-muted)">
                <Icon icon={workload.taskCount === 0 ? PiCheckCircle : PiClock} size={14} />
                {workload.taskCount === 0 ? 'Libre ahora' : `Se libera el ${fmtDate(workload.availableFrom)}`}
              </div>
            )}
            {workload.approvalCount > 0 && (
              <div className="flex items-center gap-1.5 text-(--color-text-subtle)">
                <Icon icon={PiArrowsClockwise} size={14} />
                {workload.approvalCount} en aprobación
              </div>
            )}
            {workload.upcomingVacations.length > 0 && (
              <div className="flex items-center gap-1.5 text-(--color-text-subtle)">
                <Icon icon={PiCalendarBlank} size={14} />
                Próx. vacaciones: {fmtDate(workload.upcomingVacations[0].startDate)} –{' '}
                {fmtDate(workload.upcomingVacations[0].endDate)}
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  )
}
