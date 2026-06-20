// src/hooks/queries/useWorkload.ts
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export type WorkloadStatus = 'available' | 'busy' | 'overloaded' | 'on_vacation'

export type UserLevel = 'JUNIOR' | 'MID' | 'SENIOR'

/** Cargo del diseñador: nombre del tipo + si es su cargo primario. */
export interface RoleDetail {
  typeName: string
  isPrimary: boolean
}

export interface UserWorkload {
  id: string
  name: string
  email: string
  /** Si el miembro está activo. Los inactivos se muestran con badge "Inactive"
   *  (no en skeleton) y se excluyen del timeline de capacidad. */
  active: boolean
  level: UserLevel
  roles: string[]
  /** Cargos con su tipo e indicador de primario (para derivar el título del puesto). */
  roleDetails: RoleDetail[]
  isSpecialist: boolean
  taskCount: number
  approvalCount: number
  availableFrom: string
  availableInDays: number
  status: WorkloadStatus
  currentVacation: { startDate: string; endDate: string } | null
  upcomingVacations: Array<{ startDate: string; endDate: string }>
  /** Tareas pendientes (TO_DO/IN_PROGRESS) para el timeline de capacidad. */
  pendingTasks: PendingTaskBar[]
}

export interface PendingTaskBar {
  name: string
  startDate: string
  dueDate: string
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  /** Duración real (días) si la tarea la creó Assignify; si no, undefined. */
  durationDays?: number
}

export const workloadKeys = {
  all: ['users', 'workload'] as const,
}

export const useUsersWorkload = () =>
  useQuery({
    queryKey: workloadKeys.all,
    queryFn: async (): Promise<UserWorkload[]> => {
      const { data } = await axios.get('/api/users/workload')
      return data.users ?? []
    },
    staleTime: 60 * 1000,
  })
