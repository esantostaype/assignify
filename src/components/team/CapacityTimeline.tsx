"use client";
// src/components/team/CapacityTimeline.tsx
// Timeline de capacidad: una fila por diseñador con sus tareas pendientes como barras
// (color por prioridad), bandas de vacaciones y un marcador de "se libera el…". Sirve
// para VER lo que ve el motor y detectar cuellos de botella de un vistazo.
//
// Modelo: ANCHO FIJO por día (columnas reales) dentro de un área con scroll horizontal,
// navegable ±1 mes (rueda/trackpad o arrastrando con el mouse). Las barras se posicionan
// por DÍA DE CALENDARIO local (no por la hora exacta), así cuadran con las columnas.
import React, { useMemo, useRef, useEffect } from "react";
import { Card, Tooltip } from "@/components/ui";
import { Icon, PiChartBar, PiCalendarBlank } from "@/lib/icons";
import type { UserWorkload, PendingTaskBar } from "@/hooks/queries/useWorkload";
import usHolidays from "@/data/usHolidays.json";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_W = 46; // ancho en px de cada día
const PAST_DAYS = 30; // hasta 1 mes hacia atrás
const FUTURE_DAYS = 30; // hasta 1 mes hacia adelante
const INITIAL_PAST_VISIBLE = 3; // días de historia visibles al abrir (antes de hoy)
const HEADER_H = 38;
const ROW_H = 34;
const NAME_W = 168;

const WEEKDAY_ES = ["do", "lu", "ma", "mi", "ju", "vi", "sa"];
const MONTH_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

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

// Feriados (YYYY-MM-DD) → nombre. El motor NO asigna en estos días (los salta como los findes).
const HOLIDAY_NAME_BY_YMD: Record<string, string> = Object.fromEntries(
  (usHolidays as Array<{ date: string; name: string }>).map((h) => [h.date, h.name])
);

/** Medianoche LOCAL de una fecha (descarta la hora → alinea con la columna del día). */
function midnightLocal(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function ymdLocal(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmt(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTH_ES[d.getMonth()]}`;
}

interface DayCell {
  ts: number;
  dom: number;
  weekday: string;
  isWeekend: boolean;
  isMonday: boolean;
  isToday: boolean;
  isFirstOfMonth: boolean;
  monthLabel: string;
  holiday?: string;
}

interface CapacityTimelineProps {
  workload: UserWorkload[];
  loading?: boolean;
}

export const CapacityTimeline: React.FC<CapacityTimelineProps> = ({ workload, loading }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startScroll: 0 });

  const { rangeStart, totalDays, days, rows, todayOffset } = useMemo(() => {
    const today = midnightLocal(new Date());
    const start = today - PAST_DAYS * DAY_MS;
    const total = PAST_DAYS + FUTURE_DAYS + 1;

    const dayList: DayCell[] = [];
    for (let i = 0; i < total; i++) {
      const ts = start + i * DAY_MS;
      const d = new Date(ts);
      const dow = d.getDay();
      dayList.push({
        ts,
        dom: d.getDate(),
        weekday: WEEKDAY_ES[dow],
        isWeekend: dow === 0 || dow === 6,
        isMonday: dow === 1,
        isToday: ts === today,
        isFirstOfMonth: d.getDate() === 1,
        monthLabel: MONTH_ES[d.getMonth()],
        holiday: HOLIDAY_NAME_BY_YMD[ymdLocal(ts)],
      });
    }

    // Solo ACTIVOS (los inactivos no asignan); más cargados arriba (se liberan más tarde).
    const sorted = [...workload]
      .filter((w) => w.active !== false)
      .sort((a, b) => b.availableInDays - a.availableInDays);

    return { rangeStart: start, totalDays: total, days: dayList, rows: sorted, todayOffset: PAST_DAYS };
  }, [workload]);

  // Posición (en días desde el inicio del eje) de una fecha, alineada a su columna.
  const dayOffset = (date: string) => Math.round((midnightLocal(new Date(date)) - rangeStart) / DAY_MS);

  // Centrar la vista al abrir: mostrar INITIAL_PAST_VISIBLE días de historia antes de hoy.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, (todayOffset - INITIAL_PAST_VISIBLE) * DAY_W);
    }
  }, [todayOffset]);

  // Arrastrar con el mouse para navegar (además del scroll nativo de rueda/trackpad).
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.current.active || !scrollRef.current) return;
      e.preventDefault();
      scrollRef.current.scrollLeft = drag.current.startScroll - (e.pageX - drag.current.startX);
    };
    const onUp = () => {
      drag.current.active = false;
      if (scrollRef.current) scrollRef.current.style.cursor = "grab";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    drag.current = { active: true, startX: e.pageX, startScroll: scrollRef.current.scrollLeft };
    scrollRef.current.style.cursor = "grabbing";
  };

  const trackW = totalDays * DAY_W;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Icon icon={PiChartBar} size={18} className="text-primary-500" />
        <h3 className="font-semibold text-(--color-text-strong)">Team capacity</h3>
        <span className="text-xs text-(--color-text-muted)">· arrastra para navegar (±1 mes)</span>
      </div>
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
      {header}

      <div className="flex">
        {/* Columna de nombres (fija; no scrollea). */}
        <div className="shrink-0 z-20 bg-(--color-surface-card)" style={{ width: NAME_W }}>
          <div style={{ height: HEADER_H }} />
          {rows.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-2 pr-3"
              style={{ height: ROW_H }}
            >
              <span className="truncate text-sm text-(--color-text-default)" title={u.name}>
                {u.name}
              </span>
              <span className="shrink-0 text-[11px] text-(--color-text-muted)">
                {u.status === "on_vacation" ? (
                  <span className="flex items-center gap-1">
                    <Icon icon={PiCalendarBlank} size={12} className="text-warning-500" />
                    Vac.
                  </span>
                ) : u.taskCount === 0 ? (
                  <span className="text-success-600">Free</span>
                ) : (
                  `${u.taskCount}t`
                )}
              </span>
            </div>
          ))}
        </div>

        {/* Área scrollable: header de días + pistas. */}
        <div
          ref={scrollRef}
          onMouseDown={onMouseDown}
          className="flex-1 cursor-grab select-none overflow-x-auto"
        >
          <div className="relative" style={{ width: trackW }}>
            {/* Header de días (semana marcada en lunes; hoy con badge). */}
            <div className="flex" style={{ height: HEADER_H }}>
              {days.map((d, i) => (
                <div
                  key={i}
                  className={`flex flex-col items-center justify-center text-[10px] leading-tight border-l border-dashed ${
                    d.isMonday ? "border-(--color-border-default)/40" : "border-(--color-border-subtle)/20"
                  } ${d.isWeekend ? "text-(--color-text-muted)/60" : "text-(--color-text-muted)"}`}
                  style={{ width: DAY_W }}
                >
                  <span>{d.isFirstOfMonth ? d.monthLabel : d.weekday}</span>
                  {d.isToday ? (
                    <span className="mt-0.5 flex size-5 items-center justify-center rounded-full bg-error-500 text-[10px] font-semibold text-white">
                      {d.dom}
                    </span>
                  ) : (
                    <span className="mt-0.5 font-medium text-(--color-text-default)">{d.dom}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Pistas + capa de fondo (columnas, findes, feriados, hoy) detrás. */}
            <div className="relative">
              {/* Fondo (una sola vez para todas las filas). */}
              <div className="absolute inset-0 flex">
                {days.map((d, i) => {
                  const bg = d.isToday
                    ? "bg-primary-500/[0.07]"
                    : d.holiday
                      ? "bg-error-500/[0.10] [background-image:repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.06)_5px,rgba(0,0,0,0.06)_10px)]"
                      : d.isWeekend
                        ? "bg-(--color-text-muted)/[0.08]"
                        : "";
                  const cell = (
                    <div
                      className={`h-full border-l border-dashed ${
                        d.isMonday ? "border-(--color-border-default)/40" : "border-(--color-border-subtle)/20"
                      } ${bg}`}
                      style={{ width: DAY_W }}
                    />
                  );
                  return d.holiday ? (
                    <Tooltip key={i} content={`Holiday · ${d.holiday}`}>
                      {cell}
                    </Tooltip>
                  ) : (
                    <React.Fragment key={i}>{cell}</React.Fragment>
                  );
                })}
              </div>

              {/* Línea vertical de "hoy". */}
              <div
                className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-error-500/70"
                style={{ left: todayOffset * DAY_W }}
              />

              {/* Filas: una por diseñador. */}
              {rows.map((u) => {
                const vacations = [
                  ...(u.currentVacation ? [u.currentVacation] : []),
                  ...u.upcomingVacations,
                ];
                return (
                  <div
                    key={u.id}
                    className="relative"
                    style={{ height: ROW_H }}
                  >
                    {/* Vacaciones (al fondo). */}
                    {vacations.map((v, i) => {
                      const s = Math.max(0, dayOffset(v.startDate));
                      const e = Math.min(totalDays, dayOffset(v.endDate) + 1);
                      if (e <= s) return null;
                      return (
                        <Tooltip key={`v${i}`} content={`Vacation · ${fmt(new Date(v.startDate).getTime())} – ${fmt(new Date(v.endDate).getTime())}`}>
                          <div
                            className="absolute inset-y-0 bg-warning-400/25 [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.06)_4px,rgba(0,0,0,0.06)_8px)]"
                            style={{ left: s * DAY_W, width: (e - s) * DAY_W }}
                          />
                        </Tooltip>
                      );
                    })}

                    {/* Barras de tareas, alineadas a las columnas de día. */}
                    {u.pendingTasks.map((t, i) => {
                      const s = Math.max(0, dayOffset(t.startDate));
                      const e = Math.min(totalDays, dayOffset(t.dueDate) + 1);
                      if (e <= s) return null;
                      const dur = t.durationDays !== undefined ? ` · ${t.durationDays}d` : "";
                      return (
                        <Tooltip
                          key={`t${i}`}
                          content={`${t.name} · ${PRIORITY_LABEL[t.priority]}${dur} · ${fmt(new Date(t.startDate).getTime())} → ${fmt(new Date(t.dueDate).getTime())}`}
                        >
                          <div
                            className={`absolute inset-y-1 rounded-sm ${PRIORITY_BAR[t.priority]} opacity-90 hover:opacity-100`}
                            style={{ left: s * DAY_W + 1, width: Math.max((e - s) * DAY_W - 2, 5) }}
                          />
                        </Tooltip>
                      );
                    })}

                    {/* Marcador de "se libera el…" (si tiene cola y cae dentro del rango). */}
                    {u.taskCount > 0 && (() => {
                      const off = dayOffset(u.availableFrom);
                      if (off < 0 || off > totalDays) return null;
                      return (
                        <Tooltip content={`Frees up ${fmt(new Date(u.availableFrom).getTime())}`}>
                          <div className="absolute inset-y-0 z-10 w-0.5 bg-(--color-text-strong)" style={{ left: off * DAY_W }} />
                        </Tooltip>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
