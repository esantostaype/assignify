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
import React, { useMemo, useRef, useEffect } from "react";
import { Card, Tooltip } from "@/components/ui";
import { Icon, PiChartBar, PiCalendarBlank } from "@/lib/icons";
import type { UserWorkload, PendingTaskBar } from "@/hooks/queries/useWorkload";
import usHolidays from "@/data/usHolidays.json";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_W = 46; // px per day column
const PAST_DAYS = 60; // up to 2 months back
const FUTURE_DAYS = 60; // up to 2 months ahead
const HEADER_H = 38;
const ROW_H = 34;
const NAME_W = 200;
const BAR_PAD = 4; // px inset of a work day inside its column (10:00 .. 19:00)
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

// Holidays (YYYY-MM-DD) → name. The engine never schedules on these (skips them like weekends).
const HOLIDAY_NAME_BY_YMD: Record<string, string> = Object.fromEntries(
  (usHolidays as Array<{ date: string; name: string }>).map((h) => [h.date, h.name])
);

/** Local midnight of a date (drops the time → aligns with the day column). */
function midnightLocal(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function ymdLocal(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmt(ts: number): string {
  const d = new Date(ts);
  return `${MONTH[d.getMonth()]} ${d.getDate()}`;
}
function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
        weekday: WEEKDAY[dow],
        isWeekend: dow === 0 || dow === 6,
        isToday: ts === today,
        isFirstOfMonth: d.getDate() === 1,
        monthLabel: MONTH[d.getMonth()],
        holiday: HOLIDAY_NAME_BY_YMD[ymdLocal(ts)],
      });
    }

    // Active members only (inactive don't get assigned); most loaded on top.
    const sorted = [...workload]
      .filter((w) => w.active !== false)
      .sort((a, b) => b.availableInDays - a.availableInDays);

    return { rangeStart: start, totalDays: total, days: dayList, rows: sorted, todayOffset: PAST_DAYS };
  }, [workload]);

  const trackW = totalDays * DAY_W;

  // Day index (whole days from the axis start) — used for full-day vacation bands.
  const dayOffset = (date: string) => Math.round((midnightLocal(new Date(date)) - rangeStart) / DAY_MS);

  // Horizontal position mapping the WORK DAY (10:00–19:00) to the column: 10:00 → left
  // edge + BAR_PAD, 19:00 → right edge − BAR_PAD. So a 4h task fills ~half a column and a
  // full work day fills it (minus padding), and bars line up with their day's column.
  const xOfWork = (date: string) => {
    const d = new Date(date);
    const dayIdx = Math.round((midnightLocal(d) - rangeStart) / DAY_MS);
    const h = d.getHours() + d.getMinutes() / 60;
    const frac = Math.max(0, Math.min(1, (h - WORK_START_H) / (WORK_END_H - WORK_START_H)));
    return dayIdx * DAY_W + BAR_PAD + frac * (DAY_W - 2 * BAR_PAD);
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
      <div className="flex items-center gap-2">
        <Icon icon={PiChartBar} size={18} className="text-primary-500" />
        <h3 className="font-semibold text-(--color-text-strong)">Team capacity</h3>
        <span className="text-xs text-(--color-text-muted)">· drag to navigate (±2 months)</span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-(--color-text-muted)">
        {(Object.keys(PRIORITY_LABEL) as PendingTaskBar["priority"][]).map((p) => (
          <span key={p} className="flex items-center gap-1">
            <span className={`inline-block size-2.5 rounded-sm ${PRIORITY_BAR[p]}`} />
            {PRIORITY_LABEL[p]}
          </span>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <>
        {header}
        <Card variant="outlined" padding="md" className="mt-3">
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-7 shrink-0 animate-pulse rounded bg-(--color-surface-subtle)" style={{ width: NAME_W }} />
                <div className="h-7 flex-1 animate-pulse rounded bg-(--color-surface-subtle)" />
              </div>
            ))}
          </div>
        </Card>
      </>
    );
  }

  if (rows.length === 0) return null;

  // A single dashed vertical grid line, same tone for every day.
  const gridLine = "border-l border-dashed border-(--color-border-default)/20";
  // Weekend / holiday shading (more visible than before).
  const weekendBg =
    "bg-(--color-text-muted)/[0.10] [background-image:repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.14)_5px,rgba(0,0,0,0.14)_10px)]";
  const holidayBg =
    "bg-error-500/[0.12] [background-image:repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.10)_5px,rgba(0,0,0,0.10)_10px)]";

  return (
    <>
      {header}

      <Card variant="outlined" padding="none" className="mt-3 flex overflow-hidden">
        {/* Names column (fixed; doesn't scroll). */}
        <div className="shrink-0 z-20 px-4" style={{ width: NAME_W }}>
          <div style={{ height: HEADER_H }} />
          {rows.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2" style={{ height: ROW_H }}>
              <span className="truncate text-sm text-(--color-text-default)" title={u.name}>
                {u.name}
              </span>
              <span className="shrink-0 text-[11px] text-(--color-text-muted)">
                {u.status === "on_vacation" ? (
                  <span className="flex items-center gap-1">
                    <Icon icon={PiCalendarBlank} size={12} className="text-warning-500" />
                    Off
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

        {/* Scrollable area: day header + tracks. */}
        <div ref={scrollRef} onMouseDown={onMouseDown} className="flex-1 cursor-grab select-none overflow-x-auto">
          <div className="relative" style={{ width: trackW }}>
            {/* Day header (today badged). */}
            <div className="flex" style={{ height: HEADER_H }}>
              {days.map((d, i) => (
                <div
                  key={i}
                  className={`flex flex-col items-center justify-center text-[10px] leading-tight ${gridLine} ${
                    d.isWeekend ? "text-(--color-text-muted)/40" : "text-(--color-text-muted)"
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
              ))}
            </div>

            {/* Tracks + background layer (columns, weekends, holidays). */}
            <div className="relative">
              {/* Background (once for all rows). */}
              <div className="absolute inset-0 flex">
                {days.map((d, i) => {
                  const bg = d.holiday ? holidayBg : d.isWeekend ? weekendBg : "";
                  const cell = <div className={`h-full ${gridLine} ${bg}`} style={{ width: DAY_W }} />;
                  return d.holiday ? (
                    <Tooltip key={i} content={`Holiday · ${d.holiday}`}>
                      {cell}
                    </Tooltip>
                  ) : (
                    <React.Fragment key={i}>{cell}</React.Fragment>
                  );
                })}
              </div>

              {/* Today line (centered on today's column). */}
              <div
                className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-error-500"
                style={{ left: todayOffset * DAY_W + DAY_W / 2 }}
              />

              {/* Rows: one per designer. */}
              {rows.map((u) => {
                const vacations = [...(u.currentVacation ? [u.currentVacation] : []), ...u.upcomingVacations];
                return (
                  <div key={u.id} className="relative" style={{ height: ROW_H }}>
                    {/* Vacations (full-day bands, behind the bars). */}
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

                    {/* Task bars: positioned/sized over the WORK DAY (real duration). */}
                    {u.pendingTasks.map((t, i) => {
                      const left = Math.max(0, xOfWork(t.startDate));
                      const right = Math.min(trackW, xOfWork(t.dueDate));
                      if (right <= left) return null;
                      return (
                        <Tooltip
                          key={`t${i}`}
                          content={
                            <span className="flex flex-col gap-1">
                              <span className="font-semibold">{t.name}</span>
                              <span className="flex items-center gap-1.5 opacity-80">
                                <Icon icon={PiCalendarBlank} size={12} />
                                {rangeLabel(t.startDate, t.dueDate)}
                              </span>
                            </span>
                          }
                        >
                          <div
                            className={`absolute inset-y-1 rounded ${PRIORITY_BAR[t.priority]}`}
                            style={{ left, width: Math.max(right - left, 6) }}
                          />
                        </Tooltip>
                      );
                    })}

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
      </Card>
    </>
  );
};
