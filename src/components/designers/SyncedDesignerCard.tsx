"use client";
// src/components/designers/SyncedDesignerCard.tsx
// Tarjeta COMPLETA de un diseñador sincronizado: fusiona la identidad
// (foto, nombre, puesto, email, botón editar) con su carga de trabajo
// (barra, "Frees up on…", "N in approval", vacaciones). El chip de estado va
// abajo a la derecha.
import React from "react";
import {
  Card,
  Chip,
  Progress,
  Avatar,
  Tooltip,
  Skeleton,
} from "@/components/ui";
import {
  Icon,
  PiCalendarBlank,
  PiClock,
  PiCheckCircle,
  PiSparkle,
  PiArrowsClockwise,
  PiEnvelope,
  PiPencilSimple,
} from "@/lib/icons";
import { IconButton } from "@/components/ui";
import type { UserWorkload, WorkloadStatus } from "@/hooks/queries/useWorkload";
import { levelLabel, primaryRole, typeToJobTitle } from "./designerUtils";

// Estado de carga: labels y colores (compartidos con la vista de "team workload").
const STATUS: Record<
  WorkloadStatus,
  { label: string; color: "success" | "primary" | "error" | "warning" }
> = {
  available: { label: "Available", color: "success" },
  busy: { label: "Busy", color: "primary" },
  overloaded: { label: "Overloaded", color: "error" },
  on_vacation: { label: "On vacation", color: "warning" },
};

// Horizonte (días) que llena la barra al 100%: el umbral de "overloaded".
const HORIZON_DAYS = 14;

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

export interface DesignerUser {
  clickupId: string;
  name: string;
  email: string;
  profilePicture: string;
  initials: string;
  color: string;
  existsInLocal: boolean;
  canSync: boolean;
  lastActive?: string;
}

interface SyncedDesignerCardProps {
  user: DesignerUser;
  /** Carga de trabajo cruzada por id (workload.id === user.clickupId). */
  workload?: UserWorkload;
  /** True mientras la query de carga está cargando (muestra esqueleto de carga). */
  workloadLoading?: boolean;
  onEdit?: () => void;
}

export const SyncedDesignerCard: React.FC<SyncedDesignerCardProps> = ({
  user,
  workload,
  workloadLoading = false,
  onEdit,
}) => {
  const st = workload ? STATUS[workload.status] : null;

  // Puesto: "{Level} {JobTitle}" (nivel en negrita), derivado del cargo primario.
  const level = levelLabel(workload?.level);
  const role = primaryRole(workload?.roleDetails ?? []);
  const jobTitle = role ? typeToJobTitle(role.typeName) : null;

  // La barra representa cuán lejos está su fecha de disponibilidad (0 = libre hoy,
  // 100% = a 2 semanas o más → overloaded).
  const loadPct = workload
    ? Math.min(100, Math.round((workload.availableInDays / HORIZON_DAYS) * 100))
    : 0;
  const barColor =
    workload?.status === "overloaded"
      ? "error"
      : workload?.status === "on_vacation"
        ? "warning"
        : workload?.status === "busy"
          ? "primary"
          : "success";

  return (
    <Card variant="outlined" padding="md" className="flex flex-col gap-3">
      {/* Cabecera: identidad + editar */}
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
            <p className="truncate font-semibold text-(--color-text-strong)">
              {user.name}
            </p>
            {workload?.isSpecialist && (
              <Tooltip content="Specialist">
                <span className="inline-flex">
                  <Icon
                    icon={PiSparkle}
                    size={14}
                    className="text-primary-500"
                  />
                </span>
              </Tooltip>
            )}
          </div>
          {/* Puesto: nivel en negrita + título del cargo primario */}
          <p className="truncate text-xs text-neutral-600">
            {level || jobTitle ? (
              <>
                {level && (
                  <span className="font-semibold text-(--color-text-default)">
                    {level}
                  </span>
                )}
                {level && jobTitle ? " " : ""}
                {jobTitle}
              </>
            ) : (
              "No role"
            )}
          </p>
        </div>

        {onEdit && (
          <IconButton
            aria-label="Edit user"
            size="sm"
            variant="soft"
            color="primary"
            className="shrink-0"
            onClick={onEdit}
          >
            <Icon icon={PiPencilSimple} size={16} />
          </IconButton>
        )}
      </div>

      {/* Email */}
      <div className="flex items-center gap-1.5 text-xs text-neutral-600">
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
          {/* Barra de carga (tareas pendientes: TO_DO / In progress) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs text-neutral-600">
              <span>Load</span>
              <span className="font-medium text-(--color-text-default)">
                {workload.taskCount}{" "}
                {workload.taskCount === 1 ? "pending task" : "pending tasks"}
              </span>
            </div>
            <Progress value={loadPct} color={barColor} />
          </div>

          {/* Disponibilidad / vacaciones */}
          <div className="flex justify-between gap-1 text-xs">
            <div>
              {workload.status === "on_vacation" && workload.currentVacation ? (
                <div className="flex items-center gap-1.5 text-warning-600">
                  <Icon icon={PiCalendarBlank} size={14} />
                  On vacation until {fmtDate(workload.currentVacation.endDate)}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-neutral-600">
                  <Icon
                    icon={workload.taskCount === 0 ? PiCheckCircle : PiClock}
                    size={14}
                  />
                  {workload.taskCount === 0
                    ? "Free now"
                    : `Frees up on ${fmtDate(workload.availableFrom)}`}
                </div>
              )}
              {workload.approvalCount > 0 && (
                <div className="flex items-center gap-1.5 text-(--color-text-subtle)">
                  <Icon icon={PiArrowsClockwise} size={14} />
                  {workload.approvalCount} in approval
                </div>
              )}
              {workload.upcomingVacations.length > 0 && (
                <div className="flex items-center gap-1.5 text-(--color-text-subtle)">
                  <Icon icon={PiCalendarBlank} size={14} />
                  Next vacation:{" "}
                  {fmtDate(workload.upcomingVacations[0].startDate)} –{" "}
                  {fmtDate(workload.upcomingVacations[0].endDate)}
                </div>
              )}
            </div>

            {/* Estado: abajo a la derecha */}
            {st && (
              <div className="mt-auto flex justify-end pt-1">
                <Chip color={st.color} variant="soft" size="sm">
                  {st.label}
                </Chip>
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
};
