"use client";
// src/components/team/SyncedMemberCard.tsx
// Tarjeta COMPLETA de un miembro sincronizado: identidad (foto, nombre, puesto,
// editar) + carga de trabajo (barra, "Frees up on…", aprobación, vacaciones) con
// el chip de estado. El skeleton se muestra SOLO mientras la carga está cargando;
// si el miembro está inactivo se pinta una tarjeta atenuada con badge "Inactive".
import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar03Icon,
  Clock01Icon,
  CheckmarkCircle02Icon,
  SparklesIcon,
  ArrowReloadHorizontalIcon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import { Card } from "@/components/shadcn/card";
import { Badge } from "@/components/shadcn/badge";
import { Progress } from "@/components/shadcn/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { Tooltip } from "@/components/shadcn/tooltip";
import type { UserWorkload, WorkloadStatus } from "@/hooks/queries/useWorkload";
import { levelLabel, primaryRole, typeToJobTitle } from "./memberUtils";
import { MemberCardSkeleton } from "./MemberCardSkeleton";
import { avatarColor } from "@/lib/avatarColor";

type BadgeVariant = "success" | "default" | "destructive" | "warning";

const STATUS: Record<WorkloadStatus, { label: string; variant: BadgeVariant }> = {
  available: { label: "Available", variant: "success" },
  busy: { label: "Busy", variant: "default" },
  overloaded: { label: "Overloaded", variant: "destructive" },
  on_vacation: { label: "On vacation", variant: "warning" },
};

const HORIZON_DAYS = 14;

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

export interface MemberUser {
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

interface SyncedMemberCardProps {
  user: MemberUser;
  /** Carga de trabajo cruzada por id (workload.id === user.clickupId). */
  workload?: UserWorkload;
  /** True mientras la query de carga está cargando. */
  workloadLoading?: boolean;
  onEdit?: () => void;
}

export const SyncedMemberCard: React.FC<SyncedMemberCardProps> = ({
  user,
  workload,
  workloadLoading = false,
  onEdit,
}) => {
  // Skeleton SOLO mientras la carga está en vuelo (no cuando simplemente falta,
  // que es el caso de un miembro inactivo → se quedaba colgado para siempre).
  if (workloadLoading) return <MemberCardSkeleton />;

  const level = workload ? levelLabel(workload.level) : null;
  const role = workload ? primaryRole(workload.roleDetails ?? []) : null;
  const jobTitle = role ? typeToJobTitle(role.typeName) : null;
  const isInactive = !workload || workload.active === false;

  // Cabecera de identidad (compartida entre tarjeta activa e inactiva).
  const headerRow = (
    <div className="flex items-start gap-3">
      <Avatar className="size-11">
        {user.profilePicture && <AvatarImage src={user.profilePicture} alt={user.name} />}
        <AvatarFallback className="text-white" style={{ backgroundColor: avatarColor(user.color, user.clickupId) }}>
          {user.initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-semibold text-foreground">{user.name}</p>
          {workload?.isSpecialist && (
            <Tooltip content="Specialist">
              <span className="inline-flex">
                <HugeiconsIcon icon={SparklesIcon} size={14} className="text-primary" />
              </span>
            </Tooltip>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {level || jobTitle ? (
            <>
              {level && <span className="font-semibold text-foreground">{level}</span>}
              {level && jobTitle ? " " : ""}
              {jobTitle}
            </>
          ) : (
            "No role"
          )}
        </p>
      </div>

      {onEdit && (
        <Button aria-label="Edit user" size="icon-sm" variant="soft" className="shrink-0" onClick={onEdit}>
          <HugeiconsIcon icon={PencilEdit02Icon} size={16} />
        </Button>
      )}
    </div>
  );

  // ── Inactivo: tarjeta atenuada con badge, sin barra de carga ──────────────
  if (isInactive) {
    return (
      <Card className="flex flex-col gap-3 p-4 opacity-70">
        {headerRow}
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-(--color-text-subtle)">Not considered for auto-assignment.</span>
          <Badge variant="secondary">Inactive</Badge>
        </div>
      </Card>
    );
  }

  const st = STATUS[workload.status];
  const loadPct = Math.min(100, Math.round((workload.availableInDays / HORIZON_DAYS) * 100));
  const barColor =
    workload.status === "overloaded"
      ? "error"
      : workload.status === "on_vacation"
        ? "warning"
        : workload.status === "busy"
          ? "primary"
          : "success";

  return (
    <Card className="relative flex flex-col justify-between gap-3 p-4">
      {headerRow}

      {/* Barra de carga (tareas pendientes: TO_DO / In progress) */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Load</span>
          <span className="font-medium text-foreground">
            {workload.taskCount} {workload.taskCount === 1 ? "pending task" : "pending tasks"}
          </span>
        </div>
        <Progress value={loadPct} color={barColor} />
      </div>

      {/* Disponibilidad / vacaciones + estado */}
      <div className="flex justify-between gap-1 text-xs">
        <div className="space-y-1">
          {workload.status === "on_vacation" && workload.currentVacation ? (
            <div className="flex items-center gap-1.5 text-warning-600">
              <HugeiconsIcon icon={Calendar03Icon} size={14} />
              On vacation until {fmtDate(workload.currentVacation.endDate)}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <HugeiconsIcon icon={workload.taskCount === 0 ? CheckmarkCircle02Icon : Clock01Icon} size={14} />
              {workload.taskCount === 0 ? "Free now" : `Frees up on ${fmtDate(workload.availableFrom)}`}
            </div>
          )}
          {workload.approvalCount > 0 && (
            <div className="flex items-center gap-1.5 text-(--color-text-subtle)">
              <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={14} />
              {workload.approvalCount} in approval
            </div>
          )}
          {workload.upcomingVacations.length > 0 && (
            <div className="flex items-center gap-1.5 text-(--color-text-subtle)">
              <HugeiconsIcon icon={Calendar03Icon} size={14} />
              Next vacation: {fmtDate(workload.upcomingVacations[0].startDate)} – {fmtDate(workload.upcomingVacations[0].endDate)}
            </div>
          )}
        </div>

        {st && (
          <div className="mt-auto flex justify-end pt-1">
            <Badge variant={st.variant}>{st.label}</Badge>
          </div>
        )}
      </div>
    </Card>
  );
};
