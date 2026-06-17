/* eslint-disable @typescript-eslint/no-explicit-any */
// src/hooks/queries/useTasks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

interface Task {
  clickupId: string
  customId?: string | null
  name: string
  description: string
  status: string
  statusColor: string
  priority: string
  priorityColor: string
  assignees: Array<{
    id: string
    name: string
    email: string
    initials: string
    color: string
  }>
  dueDate?: string | null
  startDate?: string | null
  timeEstimate?: number | null
  tags: string[]
  list: { id: string; name: string }
  space: { id: string; name: string }
  url: string
  existsInLocal: boolean
  canSync: boolean
}

interface TaskSyncResponse {
  clickupTasks: Task[]
  statistics: {
    totalClickUpTasks: number
    existingInLocal: number
    availableToSync: number
    totalLocalTasks: number
  }
}

interface Brand {
  id: string
  name: string
  isActive: boolean
}

// Query Keys
export const taskKeys = {
  all: ['tasks'] as const,
  clickup: () => [...taskKeys.all, 'clickup'] as const,
  brands: () => ['brands'] as const,
}

// La lista del tablero se lee en vivo de ClickUp; el realtime (Pusher) la invalida.
export const useClickUpTasks = () => {
  return useQuery({
    queryKey: taskKeys.clickup(),
    queryFn: async (): Promise<TaskSyncResponse> => {
      const { data } = await axios.get('/api/sync/clickup-tasks')
      return data
    },
    staleTime: 3 * 60 * 1000,
  })
}

export const useTaskBrands = () => {
  return useQuery({
    queryKey: taskKeys.brands(),
    queryFn: async (): Promise<Brand[]> => {
      const { data } = await axios.get('/api/brands')
      return data?.filter((b: Brand) => b.isActive) || []
    },
    staleTime: 10 * 60 * 1000,
  })
}

export const useRefreshTasks = (options?: {
  onSuccess?: () => void
  onError?: (error: any) => void
}) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({ queryKey: taskKeys.clickup() })
      return 'refreshed'
    },
    onSuccess: () => options?.onSuccess?.(),
    onError: options?.onError,
  })
}
