// src/hooks/queries/useWorkload.ts
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export type WorkloadStatus = 'available' | 'busy' | 'overloaded' | 'on_vacation'

export interface UserWorkload {
  id: string
  name: string
  email: string
  roles: string[]
  isSpecialist: boolean
  taskCount: number
  approvalCount: number
  totalDurationDays: number
  availableFrom: string
  availableInDays: number
  status: WorkloadStatus
  currentVacation: { startDate: string; endDate: string } | null
  upcomingVacations: Array<{ startDate: string; endDate: string }>
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
