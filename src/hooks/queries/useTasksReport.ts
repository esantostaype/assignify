// src/hooks/queries/useTasksReport.ts
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

// ─── Tipos de series ─────────────────────────────────────────────────────────
export interface MonthPoint {
  key: string
  label: string
  days: number
  hours: number
}
export interface WorkloadSeries {
  months: MonthPoint[]
  totalDays: number
  totalHours: number
  includedTasks: number
  skippedNoDates: number
  hoursPerDay: number
  from: string | null
  to: string | null
  truncated: boolean
}

export interface CreatedMonthPoint {
  key: string
  label: string
  count: number
}
export interface CreatedSeries {
  months: CreatedMonthPoint[]
  total: number
  adjusted: number
  from: string | null
  to: string | null
  truncated: boolean
}

export interface DemandMonthPoint {
  key: string
  label: string
  days: number
  hours: number
  tasks: number
}
export interface DemandSeries {
  months: DemandMonthPoint[]
  totalDays: number
  totalHours: number
  totalTasks: number
  adjusted: number
  hoursPerDay: number
  skippedNoDates: number
  from: string | null
  to: string | null
  truncated: boolean
}

// ─── Filtros ─────────────────────────────────────────────────────────────────
export interface ReportFilters {
  assigneeIds?: string[]
  from?: number | null
  to?: number | null
}

function qs(f?: ReportFilters): string {
  const p = new URLSearchParams()
  if (f?.assigneeIds?.length) p.set('assignees', f.assigneeIds.join(','))
  if (f?.from != null) p.set('from', String(f.from))
  if (f?.to != null) p.set('to', String(f.to))
  const s = p.toString()
  return s ? `?${s}` : ''
}

function filterKey(f?: ReportFilters) {
  return [f?.assigneeIds?.slice().sort() ?? [], f?.from ?? null, f?.to ?? null] as const
}

export const reportKeys = {
  workload: () => ['reports', 'workload'] as const,
  created: () => ['reports', 'created'] as const,
  demand: () => ['reports', 'demand'] as const,
}

export const useWorkloadReport = (filters?: ReportFilters, enabled = true) =>
  useQuery({
    queryKey: [...reportKeys.workload(), filterKey(filters)],
    queryFn: async (): Promise<WorkloadSeries> =>
      (await axios.get(`/api/reports/tasks-created${qs(filters)}`)).data,
    enabled,
    staleTime: 5 * 60 * 1000,
  })

export const useCreatedReport = (filters?: ReportFilters, enabled = true) =>
  useQuery({
    queryKey: [...reportKeys.created(), filterKey(filters)],
    queryFn: async (): Promise<CreatedSeries> =>
      (await axios.get(`/api/reports/created${qs(filters)}`)).data,
    enabled,
    staleTime: 5 * 60 * 1000,
  })

export const useDemandReport = (filters?: ReportFilters, enabled = true) =>
  useQuery({
    queryKey: [...reportKeys.demand(), filterKey(filters)],
    queryFn: async (): Promise<DemandSeries> =>
      (await axios.get(`/api/reports/demand${qs(filters)}`)).data,
    enabled,
    staleTime: 5 * 60 * 1000,
  })

// ─── Miembros del equipo (para el filtro por personas) ───────────────────────
export interface TeamMember {
  id: string
  name: string
  initials: string
  color: string
  profilePicture: string | null
}

export const useTeamMembers = () =>
  useQuery({
    queryKey: ['team-members'],
    queryFn: async (): Promise<TeamMember[]> => {
      const { data } = await axios.get('/api/users')
      return (data as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
        .map((u) => ({
          id: String(u.clickupId ?? u.id),
          name: u.name ?? u.email ?? 'Unknown',
          initials: (u.name ?? '?').slice(0, 2).toUpperCase(),
          color: u.color ?? '',
          profilePicture: u.profilePicture ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    staleTime: 10 * 60 * 1000,
  })
