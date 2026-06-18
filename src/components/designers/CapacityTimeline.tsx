"use client";
// src/components/designers/CapacityTimeline.tsx
// Timeline de capacidad del equipo: una fila por diseñador con sus tareas
// pendientes como barras (color por prioridad), bandas de vacaciones y un marcador
// de "se libera el…". Sirve para VER lo que ve el motor (por qué sugiere a quien
// sugiere) y detectar cuellos de botella de un vistazo.
import React, { useMemo } from "react";
import { Card, Tooltip } from "@/components/ui";
import { Icon, PiChartBar, PiCalendarBlank } from "@/lib/icons";
import type { UserWorkload, PendingTaskBar } from "@/hooks/queries/useWorkload";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_DAYS = 14; // ventana mínima del eje
const MAX_DAYS = 60; // tope para no aplastar las barras con colas larguísimas

const PRIORITY_BAR: Record<PendingTaskBar["priority"], string> = {
  URGENT: "bg-error-500",
  HIGH: "bg-warning-500",
  NORMAL: "bg-primary-500",
  LOW: "bg-neutral-400",
};
const PRIORITY_LABEL: Record<PendingTaskBar["priority"], string> = {
  URGENT: "Urgent",
  HIGH: "High",
  NORMAL: "Normal",
  LOW: "Low",
};

function startOfToday(): number {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
}

function fmt(d: number | string): string {
  return new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

interface CapacityTimelineProps {
  workload: UserWorkload[];
  loading?: boolean;
}

export const CapacityTimeline: React.FC<CapacityTimelineProps> = ({ workload, loading }) => {
  const { windowStart, spanMs, ticks, rows } = useMemo(() => {
    const start = startOfToday();
    let maxEnd = start + MIN_DAYS * DAY_MS;
    for (const u of workload) {
      for (const t of u.pendingTasks) maxEnd = Math.max(maxEnd, new Date(t.dueDate).getTime());
      if (u.currentVacation) maxEnd = Math.max(maxEnd, new Date(u.currentVacation.endDate).getTime());
      for (const v of u.upcomingVacations) maxEnd = Math.max(maxEnd, new Date(v.endDate).getTime());
    }
    const end = Math.min(maxEnd, start + MAX_DAYS * DAY_MS);
    const span = Math.max(end - start, MIN_DAYS * DAY_MS);

    const totalDays = Math.ceil(span / DAY_MS);
    const step = totalDays <= 21 ? 7 : Math.ceil(totalDays / 42) * 7; // ~6 marcas semanales
    const tickList: { leftPct: number; label: string }[] = [];
    for (let d = 0; d <= totalDays; d += step) {
      tickList.push({ leftPct: ((d * DAY_MS) / span) * 100, label: fmt(start + d * DAY_MS) });
    }

    // Más cargados arriba (mayor fecha de liberación primero) → los cuellos de botella saltan a la vista.
    const sorted = [...workload].sort((a, b) => b.availableInDays - a.availableInDays);
    return { windowStart: start, spanMs: span, ticks: tickList, rows: sorted };
  }, [workload]);

  const clampPct = (p: number) => Math.max(0, Math.min(100, p));
  const pos = (date: string) => clampPct(((new Date(date).getTime() - windowStart) / spanMs) * 100);

  const header = (
    <div className="flex items-center gap-2">
      <Icon icon={PiChartBar} size={18} className="text-primary-500" />
      <h3 className="font-semibold text-(--color-text-strong)">Team capacity</h3>
      <span className="text-xs text-(--color-text-muted)">· next {Math.round(spanMs / DAY_MS)} days</span>
    </div>
  );

  if (loading) {
    return (
      <Card variant="outlined" padding="md" className="flex flex-col gap-3">
        {header}
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-7 w-44 shrink-0 animate-pulse rounded bg-(--color-surface-subtle)" />
              <div className="h-7 flex-1 animate-pulse rounded bg-(--color-surface-subtle)" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (workload.length === 0) return null;

  return (
    <Card variant="outlined" padding="md" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {header}
        {/* Leyenda de prioridad */}
        <div className="flex items-center gap-3 text-[11px] text-(--color-text-muted)">
          {(Object.keys(PRIORITY_LABEL) as PendingTaskBar["priority"][]).map((p) => (
            <span key={p} className="flex items-center gap-1">
              <span className={`inline-block size-2.5 rounded-sm ${PRIORITY_BAR[p]}`} />
              {PRIORITY_LABEL[p]}
            </span>
          ))}
        </div>
      </div>

      {/* Eje temporal (alineado con las pistas vía el spacer de ancho de etiqueta). */}
      <div className="flex items-end gap-3">
        <div className="w-44 shrink-0" />
        <div className="relative h-4 flex-1">
          {ticks.map((tk, i) => (
            <span
              key={i}
              className="absolute -translate-x-1/2 text-[10px] text-(--color-text-muted)"
              style={{ left: `${tk.leftPct}%` }}
            >
              {tk.label}
            </span>
          ))}
        </div>
      </div>

      {/* Filas: una por diseñador. */}
      <div className="flex flex-col gap-1.5">
        {rows.map((u) => {
          const vacations = [
            ...(u.currentVacation ? [u.currentVacation] : []),
            ...u.upcomingVacations,
          ];
          return (
            <div key={u.id} className="flex items-center gap-3">
              <div className="w-44 shrink-0 truncate text-sm text-(--color-text-default)" title={u.name}>
                {u.name}
              </div>

              <div className="relative h-7 flex-1 overflow-hidden rounded bg-(--color-surface-subtle)">
                {/* Bandas de vacaciones (al fondo). */}
                {vacations.map((v, i) => {
                  const left = pos(v.startDate);
                  const width = Math.max(pos(v.endDate) - left, 0.8);
                  return (
                    <Tooltip key={`v${i}`} content={`Vacation · ${fmt(v.startDate)} – ${fmt(v.endDate)}`}>
                      <div
                        className="absolute inset-y-0 bg-warning-400/25 [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.06)_4px,rgba(0,0,0,0.06)_8px)]"
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                    </Tooltip>
                  );
                })}

                {/* Barras de tareas. */}
                {u.pendingTasks.map((t, i) => {
                  const left = pos(t.startDate);
                  const width = Math.max(pos(t.dueDate) - left, 1.5);
                  const dur = t.durationDays !== undefined ? ` · ${t.durationDays}d` : "";
                  return (
                    <Tooltip
                      key={`t${i}`}
                      content={`${t.name} · ${PRIORITY_LABEL[t.priority]}${dur} · ${fmt(t.startDate)} → ${fmt(t.dueDate)}`}
                    >
                      <div
                        className={`absolute inset-y-1 rounded-sm ${PRIORITY_BAR[t.priority]} opacity-90 hover:opacity-100`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                    </Tooltip>
                  );
                })}

                {/* Marcador de "se libera el…" (solo si tiene cola y cae dentro de la ventana). */}
                {u.taskCount > 0 && pos(u.availableFrom) < 100 && (
                  <Tooltip content={`Frees up ${fmt(u.availableFrom)}`}>
                    <div
                      className="absolute inset-y-0 w-0.5 bg-(--color-text-strong)"
                      style={{ left: `${pos(u.availableFrom)}%` }}
                    />
                  </Tooltip>
                )}
              </div>

              {/* Resumen a la derecha. */}
              <div className="flex w-28 shrink-0 items-center justify-end gap-1 text-xs text-(--color-text-muted)">
                {u.status === "on_vacation" ? (
                  <>
                    <Icon icon={PiCalendarBlank} size={13} className="text-warning-500" />
                    On vacation
                  </>
                ) : u.taskCount === 0 ? (
                  <span className="text-success-600">Free now</span>
                ) : (
                  <>
                    {u.taskCount} {u.taskCount === 1 ? "task" : "tasks"}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
