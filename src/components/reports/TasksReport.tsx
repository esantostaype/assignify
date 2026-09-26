'use client'
// Reportes — vista única "Demand": work-days solicitados por mes de creación.
// shadcn + hugeicons + ECharts. Solo filtro de fecha, KPIs, gráfico (barras +
// línea de evolución + valor por barra) y skeleton fiel. El gráfico muestra como
// máximo los últimos 12 meses.
import React, { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgElement } from '@hugeicons/react'
import {
  RefreshIcon,
  Clock01Icon,
  Calendar03Icon,
  ChartLineData01Icon,
  ArrowUpRight01Icon,
  ArrowDownRight01Icon,
} from '@hugeicons/core-free-icons'
import { Card } from '@/components/shadcn/card'
import { Button } from '@/components/shadcn/button'
import { Badge } from '@/components/shadcn/badge'
import { Skeleton } from '@/components/shadcn/skeleton'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/shadcn/select'
import { ReportChart } from './ReportChart'
import { PageHeader } from '@/components/PageHeader'
import { useDemandReport, reportKeys, type ReportFilters } from '@/hooks/queries/useTasksReport'

type Preset = 'all' | '3m' | '6m' | '12m' | 'ytd' | 'prev-year'

const PRESET_LABEL: Record<Preset, string> = {
  all: 'All time',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
  ytd: 'This year',
  'prev-year': 'Last year',
}

function rangeToDates(p: Preset): { from: number | null; to: number | null } {
  const y = new Date().getUTCFullYear()
  const back = (m: number) => {
    const d = new Date()
    d.setMonth(d.getMonth() - m)
    return d.getTime()
  }
  switch (p) {
    case '3m': return { from: back(3), to: null }
    case '6m': return { from: back(6), to: null }
    case '12m': return { from: back(12), to: null }
    case 'ytd': return { from: Date.UTC(y, 0, 1), to: null }
    case 'prev-year': return { from: Date.UTC(y - 1, 0, 1), to: Date.UTC(y, 0, 1) - 1 }
    default: return { from: null, to: null }
  }
}

const fmtNum = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 })
const valueOf = (m: { days?: number; count?: number }) => m.days ?? m.count ?? 0

// El gráfico muestra a lo sumo los últimos N meses (los más recientes).
const MAX_MONTHS = 12

interface Kpi {
  icon: IconSvgElement
  label: string
  value: string
  sub: string
}

export const TasksReport: React.FC = () => {
  const [preset, setPreset] = useState<Preset>('all')

  const range = useMemo(() => rangeToDates(preset), [preset])
  const filters: ReportFilters = useMemo(
    () => ({ assigneeIds: [], from: range.from, to: range.to }),
    [range]
  )

  const demand = useDemandReport(filters, true)
  const qc = useQueryClient()
  const { isLoading, isError, isFetching } = demand
  const refresh = () => qc.invalidateQueries({ queryKey: reportKeys.demand() })

  const monthsRaw = useMemo(
    () => (demand.data?.months ?? []) as Array<{ key: string; label: string; days?: number; count?: number }>,
    [demand.data]
  )
  const rows = useMemo(
    () =>
      monthsRaw.map((m, i) => {
        const v = valueOf(m)
        const prev = i > 0 ? valueOf(monthsRaw[i - 1]) : null
        const pct = prev && prev > 0 ? Math.round(((v - prev) / prev) * 100) : null
        return { key: m.key, label: m.label, value: v, pct }
      }),
    [monthsRaw]
  )
  // Solo los últimos 12 meses en el gráfico.
  const chartRows = useMemo(() => rows.slice(-MAX_MONTHS), [rows])
  const last = rows[rows.length - 1]

  const kpis: Kpi[] = useMemo(() => {
    if (rows.length === 0 || !demand.data) return []
    const total = rows.reduce((s, r) => s + r.value, 0)
    const avg = total / rows.length
    const peak = rows.reduce((a, b) => (b.value > a.value ? b : a), rows[0])
    return [
      { icon: Clock01Icon, label: 'Total work-days', value: fmtNum(demand.data.totalDays), sub: `${demand.data.totalTasks.toLocaleString()} tasks` },
      { icon: Calendar03Icon, label: 'Peak month', value: peak.label, sub: `${fmtNum(peak.value)} days` },
      { icon: ChartLineData01Icon, label: 'Monthly average', value: fmtNum(avg), sub: 'days / month' },
    ]
  }, [rows, demand.data])

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
        <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(PRESET_LABEL) as Preset[]).map((p) => (
            <SelectItem key={p} value={p}>{PRESET_LABEL[p]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="secondary" size="icon" onClick={refresh} disabled={isFetching} aria-label="Refresh">
        <HugeiconsIcon icon={RefreshIcon} size={16} className={isFetching ? 'animate-spin' : ''} />
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Reports"
        description="Work requested over time — work-days by creation month"
        actions={toolbar}
      />
      <div className="flex flex-col gap-6 p-4 md:p-6">
        {isLoading ? (
          <ReportSkeleton />
        ) : isError ? (
          <Card className="flex flex-col items-center gap-3 p-12 text-center">
            <HugeiconsIcon icon={ChartLineData01Icon} size={32} className="text-muted-foreground" />
            <div className="text-foreground">Couldn&apos;t load the report</div>
            <Button variant="secondary" size="sm" onClick={refresh} className="gap-2">
              <HugeiconsIcon icon={RefreshIcon} size={16} /> Retry
            </Button>
          </Card>
        ) : rows.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-12 text-center">
            <HugeiconsIcon icon={ChartLineData01Icon} size={32} className="text-muted-foreground" />
            <div className="text-foreground">No data for these filters</div>
            <div className="text-sm text-muted-foreground">Try changing the date range.</div>
          </Card>
        ) : (
          <>
            {/* KPIs: máx 250px, no ocupan todo el ancho */}
            <div className="flex flex-wrap gap-4">
              {kpis.map((k) => (
                <Card key={k.label} className="min-w-[180px] max-w-[250px] flex-1 p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <HugeiconsIcon icon={k.icon} size={18} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">{k.label}</div>
                      <div className="mt-0.5 truncate text-xl font-semibold text-foreground">{k.value}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{k.sub}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Gráfico: barras + línea de evolución + valor por barra (máx. 12 meses) */}
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">Work-days requested per month</h2>
                {last?.pct != null && (
                  <Badge variant={last.pct > 0 ? 'success' : last.pct < 0 ? 'destructive' : 'secondary'}>
                    <HugeiconsIcon icon={last.pct >= 0 ? ArrowUpRight01Icon : ArrowDownRight01Icon} size={12} />
                    {last.pct > 0 ? '+' : ''}{last.pct}%
                    <span className="font-normal opacity-70">vs prev</span>
                  </Badge>
                )}
              </div>
              <ReportChart labels={chartRows.map((r) => r.label)} values={chartRows.map((r) => r.value)} unit="days" />
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

// Skeleton fiel: misma estructura que el contenido real (KPIs + chart de 12 barras).
function ReportSkeleton() {
  return (
    <>
      <div className="flex flex-wrap gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="min-w-[180px] max-w-[250px] flex-1 p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="size-9 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <Skeleton className="mb-4 h-4 w-40" />
        {/* Mismas barras finas (máx 34px) y separación que el gráfico real: cada barra
            centrada en una columna igual, y con el mismo margen lateral del área de plot. */}
        <div className="flex h-[340px] items-end pl-[46px] pr-[24px] pb-[28px]">
          {Array.from({ length: MAX_MONTHS }).map((_, i) => (
            <div key={i} className="flex flex-1 items-end justify-center">
              <Skeleton
                className="w-full max-w-[34px] rounded-t-md"
                style={{ height: `${52 + ((i * 43) % 45)}%` }}
              />
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
