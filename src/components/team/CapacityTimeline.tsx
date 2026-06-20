"use client";
// src/components/team/CapacityTimeline.tsx
// Timeline de capacidad del equipo: una fila por diseñador con sus tareas
// pendientes como barras (color por prioridad), bandas de vacaciones y un marcador
// de "se libera el…". Sirve para VER lo que ve el motor (por qué sugiere a quien
// sugiere) y detectar cuellos de botella de un vistazo.
import React, { useMemo } from "react";
import { Card, Tooltip } from "@/components/ui";
import { Icon, PiChartBar, PiCalendarBlank } from "@/lib/icons";
import type { UserWorkload, PendingTaskBar } from "@/hooks/queries/useWorkload";
import usHolidays from "@/data/usHolidays.json";

// Feriados (YYYY-MM-DD) → nombre. El motor NO asigna en estos días (los salta como los
// findes); aquí se sombrean en el eje para que el hueco en las barras se entienda.
const HOLIDAY_NAME_BY_YMD: Record<string, string> = Object.fromEntries(
  (usHolidays as Array<{ date: string; name: string }>).map((h) => [h.date, h.name])
);

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_DAYS = 14; // ventana mínima del eje (hacia el futuro)
const MAX_DAYS = 60; // tope para no aplastar las barras con colas larguísimas
const PAST_DAYS = 3; // días de historia visibles ANTES de hoy (ver lo recién empezado)

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

// Fecha de calendario LOCAL en formato YYYY-MM-DD (para cruzar con la lista de feriados).
function localYMD(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

interface CapacityTimelineProps {
  workload: UserWorkload[];
  loading?: boolean;
}

export const CapacityTimeline: React.FC<CapacityTimelineProps> = ({ workload, loading }) => {
  const { windowStart, spanMs, ticks, rows, weekends, holidays, todayPct } = useMemo(() => {
    const today = startOfToday();
    // El eje arranca PAST_DAYS antes de hoy (para ver lo recién empezado); la ventana
    // hacia el futuro se sigue midiendo desde HOY, igual que antes.
    const start = today - PAST_DAYS * DAY_MS;
    let maxEnd = today + MIN_DAYS * DAY_MS;
    for (const u of workload) {
      for (const t of u.pendingTasks) maxEnd = Math.max(maxEnd, new Date(t.dueDate).getTime());
      if (u.currentVacation) maxEnd = Math.max(maxEnd, new Date(u.currentVacation.endDate).getTime());
      for (const v of u.upcomingVacations) maxEnd = Math.max(maxEnd, new Date(v.endDate).getTime());
    }
    const end = Math.min(maxEnd, today + MAX_DAYS * DAY_MS);
    const span = Math.max(end - start, (PAST_DAYS + MIN_DAYS) * DAY_MS);

    const totalDays = Math.ceil(span / DAY_MS);
    const step = totalDays <= 21 ? 7 : Math.ceil(totalDays / 42) * 7; // ~6 marcas semanales
    const tickList: { leftPct: number; label: string }[] = [];
    for (let d = 0; d <= totalDays; d += step) {
      tickList.push({ leftPct: ((d * DAY_MS) / span) * 100, label: fmt(start + d * DAY_MS) });
    }

    // Bandas de fin de semana (sáb/dom): explican los huecos entre tareas, que el
    // motor genera al saltar los días no laborables. Se agrupan días consecutivos.
    const weekendList: { leftPct: number; widthPct: number }[] = [];
    for (let d = 0; d < totalDays; ) {
      const dow = new Date(start + d * DAY_MS).getDay();
      if (dow === 0 || dow === 6) {
        let len = 1;
        while (d + len < totalDays) {
          const next = new Date(start + (d + len) * DAY_MS).getDay();
          if (next === 0 || next === 6) len++;
          else break;
        }
        weekendList.push({ leftPct: ((d * DAY_MS) / span) * 100, widthPct: ((len * DAY_MS) / span) * 100 });
        d += len;
      } else d++;
    }

    // Festivos (US) dentro de la ventana: el motor NO asigna en ellos (los salta como
    // los findes). Se marcan para explicar los huecos de las barras. Uno por día.
    const holidayList: { leftPct: number; widthPct: number; name: string }[] = [];
    for (let d = 0; d < totalDays; d++) {
      const name = HOLIDAY_NAME_BY_YMD[localYMD(start + d * DAY_MS)];
      if (name) {
        holidayList.push({
          leftPct: ((d * DAY_MS) / span) * 100,
          widthPct: (DAY_MS / span) * 100,
          name,
        });
      }
    }

    // Solo ACTIVOS en la capacidad (los inactivos no asignan); más cargados arriba
    // (mayor fecha de liberación primero) → los cuellos de botella saltan a la vista.
    const sorted = [...workload]
      .filter((w) => w.active !== false)
      .sort((a, b) => b.availableInDays - a.availableInDays);
    return { windowStart: start, spanMs: span, ticks: tickList, rows: sorted, weekends: weekendList, holidays: holidayList, todayPct: ((today - start) / span) * 100 };
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

  if (rows.length === 0) return null;

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
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-sm bg-error-500/30 [background-image:repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(0,0,0,0.12)_2px,rgba(0,0,0,0.12)_4px)]" />
            Holiday
          </span>
        </div>
      </div>

      {/* Eje temporal (alineado con las pistas vía el spacer de ancho de etiqueta). */}
      <div className="flex items-end gap-3">
        <div className="w-44 shrink-0" />
        <div className="relative h-4 flex-1">
          {ticks.map((tk, i) => (
            <span
              key={i}
              className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-(--color-text-muted)"
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

              <div className="relative h-7 flex-1 overflow-hidden rounded bg-black/[0.04] dark:bg-white/[0.06]">
                {/* Fines de semana (capa más al fondo): explican los huecos. */}
                {weekends.map((w, i) => (
                  <div
                    key={`w${i}`}
                    className="absolute inset-y-0 bg-(--color-text-muted)/[0.12]"
                    style={{ left: `${w.leftPct}%`, width: `${w.widthPct}%` }}
                  />
                ))}

                {/* Festivos: el motor no asigna en estos días (los salta como los findes). */}
                {holidays.map((h, i) => (
                  <Tooltip key={`h${i}`} content={`Holiday · ${h.name}`}>
                    <div
                      className="absolute inset-y-0 bg-error-500/[0.13] [background-image:repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.06)_5px,rgba(0,0,0,0.06)_10px)]"
                      style={{ left: `${h.leftPct}%`, width: `${h.widthPct}%` }}
                    />
                  </Tooltip>
                ))}

                {/* Línea de "hoy": separa los días de historia (a la izquierda) del futuro. */}
                <Tooltip content="Today">
                  <div
                    className="absolute inset-y-0 w-px bg-primary-500/70"
                    style={{ left: `${todayPct}%` }}
                  />
                </Tooltip>

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
