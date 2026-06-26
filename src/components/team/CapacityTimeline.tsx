"use client";
// src/components/team/CapacityTimeline.tsx
// Team capacity timeline: one row per designer with their pending tasks as bars
// (color = priority), vacation bands and a "frees up" marker. Lets you SEE what the
// engine sees and spot bottlenecks at a glance.
//
// Model: FIXED width per day (real columns) inside a horizontally scrollable area,
// navigable ±2 months (wheel/trackpad or dragging with the mouse). Bars map the WORK
// DAY (10:00–19:00) to the column width, so a 4h task fills ~half a column (not a full
// day) and a full work day fills the column (minus a small padding).
import React, { useMemo, useRef, useEffect, useState } from "react";
import { Card, Tooltip, Skeleton, Avatar } from "@/components/ui";
import { Icon, PiCalendarBlank } from "@/lib/icons";
import type { UserWorkload, PendingTaskBar } from "@/hooks/queries/useWorkload";
import axios from "axios";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_W = 46; // px per day column
const PAST_DAYS = 60; // up to 2 months back
const FUTURE_DAYS = 60; // up to 2 months ahead
const WEEK_H = 22; // week-number row height
const HEADER_H = 38; // day-header row height
const ROW_H = 52;
const BAR_PAD = 2; // px inset of a work day inside its column (10:00 .. 19:00)
// Local work-day bounds (hours) used to map a task's time to a position inside its day.
// Inszone: 10:00–19:00 local. (If made fully multi-tenant, pass these from settings.)
const WORK_START_H = 10;
const WORK_END_H = 19;

const WEEKDAY = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

// Diagonal stripes from a translucent COLOR (consistent in light & dark, unlike fixed
// black). Painted per CONTIGUOUS block (not per day) so the pattern never breaks between
// e.g. Saturday and Sunday. Each band uses its own hue.
// Reparte tareas que SE SOLAPAN (corren en paralelo: p.ej. un High/Urgent sobre un Normal)
// en "sub-carriles" apilados, para que las barras no queden una encima de otra. Cada lane es
// la primera fila libre donde la tarea no se solapa con la anterior de esa fila.
function allocLanes(items: { l: number; r: number }[]): { lane: number[]; count: number } {
  const order = items.map((it, i) => ({ i, l: it.l, r: it.r })).sort((a, b) => a.l - b.l);
  const ends: number[] = [];
  const lane = new Array(items.length).fill(0) as number[];
  for (const it of order) {
    let k = ends.findIndex((end) => it.l >= end);
    if (k === -1) {
      k = ends.length;
      ends.push(it.r);
    } else {
      ends[k] = it.r;
    }
    lane[it.i] = k;
  }
  return { lane, count: Math.max(1, ends.length) };
}

const stripes = (rgba: string) =>
  `repeating-linear-gradient(45deg, transparent, transparent 3px, ${rgba} 3px, ${rgba} 6px)`;
const WEEKEND_STRIPES = stripes("rgba(148,163,184,0.20)"); // slate
const HOLIDAY_STRIPES = stripes("rgba(239,68,68,0.18)"); // red
const VACATION_STRIPES = stripes("rgba(245,158,11,0.32)"); // amber

// Los feriados ya NO salen de un JSON: se leen de la DB del workspace (/api/holidays)
// dentro del componente y se marcan visualmente. El motor también los respeta (H2).

/** Local midnight of a date (drops the time → aligns with the day column). */
function midnightLocal(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function fmt(ts: number): string {
  const d = new Date(ts);
  return `${MONTH[d.getMonth()]} ${d.getDate()}`;
}
function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
/** Week number of the year (US, weeks start on Sunday). Matches ClickUp's W-numbers. */
function weekOfYear(ts: number): number {
  const d = new Date(ts);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.round((midnightLocal(d) - jan1.getTime()) / DAY_MS) + 1;
  return Math.max(1, Math.floor((dayOfYear + jan1.getDay() - 1) / 7));
}
/** Tooltip range: "Monday 19 10:00 - 14:00" (same day) or with an arrow across days. */
function rangeLabel(startStr: string, dueStr: string): string {
  const s = new Date(startStr);
  const e = new Date(dueStr);
  if (midnightLocal(s) === midnightLocal(e)) {
    return `${WEEKDAY_LONG[s.getDay()]} ${s.getDate()} ${hhmm(s)} - ${hhmm(e)}`;
  }
  return `${WEEKDAY[s.getDay()]} ${s.getDate()} ${hhmm(s)} → ${WEEKDAY[e.getDay()]} ${e.getDate()} ${hhmm(e)}`;
}
function dateTimeLabel(str: string): string {
  const d = new Date(str);
  return `${WEEKDAY_LONG[d.getDay()]} ${d.getDate()} · ${hhmm(d)}`;
}

interface DayCell {
  ts: number;
  dom: number;
  weekday: string;
  isWeekend: boolean;
  isWeekStart: boolean; // Sunday → solid week divider
  isToday: boolean;
  isFirstOfMonth: boolean;
  monthLabel: string;
  holiday?: string;
}
interface Block {
  startIdx: number;
  len: number;
}
interface WeekCell extends Block {
  label: string;
}
interface ShadeBlock extends Block {
  type: "holiday" | "weekend";
}

interface CapacityTimelineProps {
  workload: UserWorkload[];
  loading?: boolean;
  /** Mapa email → avatar (foto/iniciales/color) de ClickUp, para la columna de nombres. */
  avatars?: Map<string, { src?: string; initials: string; color: string }>;
}

export const CapacityTimeline: React.FC<CapacityTimelineProps> = ({ workload, loading, avatars }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startScroll: 0 });

  // Feriados del workspace (de la DB) para sombrear sus columnas. El motor ya los respeta
  // (H2); aquí es solo la marca visual. Recurrentes (year null) aplican a cualquier año.
  const [holidayRows, setHolidayRows] = useState<
    { name: string; month: number; day: number; year: number | null }[]
  >([]);
  useEffect(() => {
    let alive = true;
    axios
      .get("/api/holidays")
      .then((r) => { if (alive) setHolidayRows(r.data ?? []); })
      .catch(() => { /* sin feriados: el gantt simplemente no sombrea ninguno */ });
    return () => { alive = false; };
  }, []);
  const holidayName = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const dated = new Map<string, string>(); // "YYYY-MM-DD" → nombre
    const recurring = new Map<string, string>(); // "MM-DD" → nombre
    for (const h of holidayRows) {
      const mmdd = `${pad(h.month)}-${pad(h.day)}`;
      if (h.year == null) recurring.set(mmdd, h.name);
      else dated.set(`${h.year}-${mmdd}`, h.name);
    }
    return (ts: number): string | undefined => {
      const d = new Date(ts);
      const mmdd = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return dated.get(`${d.getFullYear()}-${mmdd}`) ?? recurring.get(mmdd);
    };
  }, [holidayRows]);

  const { rangeStart, totalDays, days, weeks, shades, rows, todayOffset } = useMemo(() => {
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
        weekday: WEEKDAY[dow],
        isWeekend: dow === 0 || dow === 6,
        isWeekStart: dow === 0,
        isToday: ts === today,
        isFirstOfMonth: d.getDate() === 1,
        monthLabel: MONTH[d.getMonth()],
        holiday: holidayName(ts),
      });
    }

    // Weeks (Sunday→Saturday) for the top week-number row.
    const weekList: WeekCell[] = [];
    for (let i = 0; i < total; ) {
      let len = 1;
      while (i + len < total && !dayList[i + len].isWeekStart) len++;
      const sTs = dayList[i].ts;
      const eD = new Date(dayList[i + len - 1].ts);
      const sD = new Date(sTs);
      const end = sD.getMonth() === eD.getMonth() ? `${eD.getDate()}` : fmt(eD.getTime());
      weekList.push({ startIdx: i, len, label: `W${weekOfYear(sTs)} · ${fmt(sTs)} - ${end}` });
      i += len;
    }

    // Non-working shading grouped into CONTIGUOUS blocks of the same type (holiday wins
    // over weekend) → diagonal stripes stay continuous across e.g. Sat+Sun.
    const shadeList: ShadeBlock[] = [];
    for (let i = 0; i < total; ) {
      const type: ShadeBlock["type"] | null = dayList[i].holiday ? "holiday" : dayList[i].isWeekend ? "weekend" : null;
      if (!type) {
        i++;
        continue;
      }
      let len = 1;
      while (i + len < total) {
        const t2 = dayList[i + len].holiday ? "holiday" : dayList[i + len].isWeekend ? "weekend" : null;
        if (t2 === type) len++;
        else break;
      }
      shadeList.push({ startIdx: i, len, type });
      i += len;
    }

    const sorted = [...workload]
      .filter((w) => w.active !== false)
      .sort((a, b) => b.availableInDays - a.availableInDays);

    return { rangeStart: start, totalDays: total, days: dayList, weeks: weekList, shades: shadeList, rows: sorted, todayOffset: PAST_DAYS };
  }, [workload, holidayName]);

  const trackW = totalDays * DAY_W;

  // Horizontal position mapping the WORK DAY (10:00–19:00) to the column.
  const xOfWork = (date: string) => {
    const d = new Date(date);
    const dayIdx = Math.round((midnightLocal(d) - rangeStart) / DAY_MS);
    const h = d.getHours() + d.getMinutes() / 60;
    const frac = Math.max(0, Math.min(1, (h - WORK_START_H) / (WORK_END_H - WORK_START_H)));
    return dayIdx * DAY_W + BAR_PAD + frac * (DAY_W - 2 * BAR_PAD);
  };

  // Bandas de vacación CONTINUAS sobre todo el rango: incluyen sábados, domingos y
  // feriados que caigan dentro (la vacación del 13 al 19 se ve completa, no recortada al
  // viernes). Devuelve bloques contiguos de días dentro de las vacaciones.
  const vacationBlocks = (vacations: { startDate: string; endDate: string }[]): Block[] => {
    if (vacations.length === 0) return [];
    const inVac = (ts: number) =>
      vacations.some((v) => ts >= midnightLocal(new Date(v.startDate)) && ts <= midnightLocal(new Date(v.endDate)));
    const blocks: Block[] = [];
    for (let i = 0; i < totalDays; ) {
      if (inVac(days[i].ts)) {
        let len = 1;
        while (i + len < totalDays && inVac(days[i + len].ts)) len++;
        blocks.push({ startIdx: i, len });
        i += len;
      } else i++;
    }
    return blocks;
  };

  // On mount, center the view on TODAY (no manual scroll needed).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, todayOffset * DAY_W + DAY_W / 2 - el.clientWidth / 2);
  }, [todayOffset, rows.length]);

  // Drag with the mouse to navigate (besides native wheel/trackpad scroll).
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

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {/* Mismo estilo que el título "Synced" de la lista de miembros (text-lg semibold).
          La leyenda de prioridades va ABAJO del gantt (igual que en la guía). */}
      <h2 className="text-lg font-semibold text-(--color-text-strong)">Team capacity</h2>
    </div>
  );

  // Leyenda de prioridades (va DENTRO del Card, al fondo, como en la guía).
  const legend = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-(--color-border-default) px-3 py-2.5">
      {(["NORMAL", "LOW", "HIGH", "URGENT"] as PendingTaskBar["priority"][]).map((p) => (
        <span key={p} className="inline-flex items-center gap-1.5 text-[11px] text-(--color-text-muted)">
          <span className={`size-2.5 rounded-full ${PRIORITY_BAR[p]}`} />
          {PRIORITY_LABEL[p]}
        </span>
      ))}
    </div>
  );

  if (!loading && rows.length === 0) return null;

  // Durante la carga: 3 filas en skeleton (null = placeholder). El RESTO del armazón
  // (semanas, días, findes, "hoy", líneas) se pinta IGUAL porque no depende del workload;
  // solo los nombres van en skeleton y todavía NO se dibujan barras.
  const displayRows: Array<(typeof rows)[number] | null> = loading ? [null, null, null] : rows;

  // Vertical lines. HEADER (under the dates) = SOLID, full color. BODY (where the bars
  // are) = DASHED at half opacity. Week dividers (Sunday) = SOLID, full color (both).
  const weekLine = "border-l border-(--color-border-default)";
  const bodyDayLine = "border-l border-dashed border-(--color-border-default)/50";
  const bodyLineOf = (d: DayCell) => (d.isWeekStart ? weekLine : bodyDayLine);
  const tracksH = displayRows.length * ROW_H;

  return (
    <div className="space-y-3">
      {header}

      <Card variant="outlined" padding="none" className="mt-3 flex flex-col overflow-hidden">
        <div className="flex">
        {/* Names column (fixed; doesn't scroll). Vertical separator = card border. */}
        <div className="shrink-0 z-20 w-12 border-r border-(--color-border-default) md:w-[200px]">
          {/* full-header spacer; the only horizontal line here sits ABOVE the rows
              (not above the names). */}
          <div style={{ height: WEEK_H + HEADER_H }} className="border-b border-(--color-border-default)" />
          {displayRows.map((u, i) => (
            <div
              key={u?.id ?? `s${i}`}
              className="flex items-center justify-center gap-2.5 border-b border-(--color-border-default) px-2 last:border-b-0 md:justify-start md:px-4"
              style={{ height: ROW_H }}
            >
              {u ? (
                <>
                  {/* Foto de perfil (24px). En mobile es lo único que se muestra (sin nombre)
                      para dejar más ancho al gantt. */}
                  {(() => {
                    const a = avatars?.get(u.email);
                    return (
                      <Avatar
                        size="sm"
                        src={a?.src}
                        alt={u.name}
                        style={a?.color ? { backgroundColor: a.color, color: "#fff" } : undefined}
                      >
                        {a?.initials ?? u.name.slice(0, 2).toUpperCase()}
                      </Avatar>
                    );
                  })()}
                  <div className="hidden min-w-0 md:block">
                    <div className="truncate text-sm font-medium text-(--color-text-strong)" title={u.name}>
                      {u.name}
                    </div>
                    <div className="truncate text-[11px] text-(--color-text-muted)">
                      {u.level}
                      {u.roles[0] ? ` · ${u.roles[0]}` : ""}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Skeleton variant="circle" width={32} height={32} />
                  <div className="hidden min-w-0 flex-1 md:block">
                    <Skeleton variant="text" width="70%" />
                    <Skeleton variant="text" width="45%" className="mt-1.5" />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Scrollable area: week row + day header + tracks. */}
        <div
          ref={scrollRef}
          onMouseDown={onMouseDown}
          className="no-scrollbar flex-1 cursor-grab select-none overflow-x-auto"
        >
          <div className="relative" style={{ width: trackW }}>
            {/* Week-number row (line below = card border). */}
            <div className="flex border-b border-(--color-border-default)" style={{ height: WEEK_H }}>
              {weeks.map((w, i) => (
                <div
                  key={i}
                  className="flex items-center overflow-hidden whitespace-nowrap border-l border-(--color-border-default)/50 px-1.5 text-[10px] font-medium text-(--color-text-muted)"
                  style={{ width: w.len * DAY_W }}
                >
                  {w.label}
                </div>
              ))}
            </div>

            {/* Day header. Line below = above the rows (the one it had before). */}
            <div className="flex border-b border-(--color-border-default)" style={{ height: HEADER_H }}>
              {days.map((d, i) => {
                const cell = (
                  <div
                    className={`flex h-full flex-col items-center justify-center text-[10px] leading-tight ${weekLine} ${
                      d.isWeekend ? "bg-(--color-text-muted)/[0.07] text-(--color-text-muted)/50" : "text-(--color-text-muted)"
                    }`}
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
                );
                return d.holiday ? (
                  <Tooltip key={i} content={`${d.holiday} · ${fmt(d.ts)}`}>
                    {cell}
                  </Tooltip>
                ) : (
                  <React.Fragment key={i}>{cell}</React.Fragment>
                );
              })}
            </div>

            {/* Tracks area: shading (continuous) + grid lines + today + rows. */}
            <div className="relative" style={{ minHeight: tracksH }}>
              {/* Shading: contiguous blocks → continuous diagonals across the whole block. */}
              <div className="pointer-events-none absolute inset-0">
                {shades.map((b, i) => (
                  <div
                    key={i}
                    className="absolute inset-y-0"
                    style={{
                      left: b.startIdx * DAY_W,
                      width: b.len * DAY_W,
                      backgroundImage: b.type === "holiday" ? HOLIDAY_STRIPES : WEEKEND_STRIPES,
                    }}
                  />
                ))}
              </div>

              {/* Grid lines (above shading, below bars). */}
              <div className="pointer-events-none absolute inset-0 flex">
                {days.map((d, i) => (
                  <div key={i} className={`h-full ${bodyLineOf(d)}`} style={{ width: DAY_W }} />
                ))}
              </div>

              {/* Today line (centered on today's column). */}
              <div
                className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-error-500"
                style={{ left: todayOffset * DAY_W + DAY_W / 2 }}
              />

              {/* Rows: one per designer (en carga: filas vacías, sin barras). */}
              {displayRows.map((u, i) => {
                if (!u) return <div key={`s${i}`} className="relative border-b border-(--color-border-default) last:border-b-0" style={{ height: ROW_H }} />;
                const vacs = [...(u.currentVacation ? [u.currentVacation] : []), ...u.upcomingVacations];
                const vBlocks = vacationBlocks(vacs);
                return (
                  <div key={u.id} className="relative border-b border-(--color-border-default) last:border-b-0" style={{ height: ROW_H }}>
                    {/* Bandas de vacación continuas (incluyen fines de semana y feriados). */}
                    {vBlocks.map((b, i) => (
                      <Tooltip key={`v${i}`} content={`Vacation · ${fmt(days[b.startIdx].ts)} – ${fmt(days[b.startIdx + b.len - 1].ts)}`}>
                        <div
                          className="absolute inset-y-0"
                          style={{ left: b.startIdx * DAY_W, width: b.len * DAY_W, backgroundImage: VACATION_STRIPES }}
                        />
                      </Tooltip>
                    ))}

                    {/* Task bars over the WORK DAY (real duration). Las que SE SOLAPAN
                        (paralelas: High/Urgent sobre Normal) se apilan en sub-carriles
                        delgados separados 2px en vez de encimarse. */}
                    {(() => {
                      const bars = u.pendingTasks
                        .map((t) => ({
                          t,
                          left: Math.max(0, xOfWork(t.startDate)),
                          right: Math.min(trackW, xOfWork(t.dueDate)),
                        }))
                        .filter((b) => b.right > b.left);
                      const { lane, count } = allocLanes(bars.map((b) => ({ l: b.left, r: b.right })));
                      const GAP = 2;
                      const usableH = ROW_H - 12;
                      const barH = Math.min(18, (usableH - (count - 1) * GAP) / count);
                      const top0 = (ROW_H - (count * barH + (count - 1) * GAP)) / 2;
                      return bars.map((b, idx) => (
                        <Tooltip
                          key={`t${idx}`}
                          content={
                            <span className="flex flex-col gap-0.5">
                              <span className="font-semibold leading-tight">{b.t.name}</span>
                              <span className="flex items-center gap-1.5 opacity-80">
                                <Icon icon={PiCalendarBlank} size={12} />
                                {rangeLabel(b.t.startDate, b.t.dueDate)}
                              </span>
                            </span>
                          }
                        >
                          <div
                            className={`absolute rounded ${PRIORITY_BAR[b.t.priority]}`}
                            style={{
                              left: b.left,
                              width: Math.max(b.right - b.left, 6),
                              top: top0 + lane[idx] * (barH + GAP),
                              height: barH,
                            }}
                          />
                        </Tooltip>
                      ));
                    })()}

                    {/* "Frees up" marker (if it has a queue and falls inside the range). */}
                    {u.taskCount > 0 && (() => {
                      const x = xOfWork(u.availableFrom);
                      if (x < 0 || x > trackW) return null;
                      return (
                        <Tooltip content={`Frees up · ${dateTimeLabel(u.availableFrom)}`}>
                          <div className="absolute inset-y-0 z-10 w-0.5 bg-(--color-text-strong)" style={{ left: x }} />
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
        {legend}
      </Card>
    </div>
  );
};
