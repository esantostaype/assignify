// src/hooks/queries/useWorkspaces.ts  [SaaS fase 4 — selector multi-workspace]
import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'

export interface Workspace {
  id: string
  name: string | null
}

interface WorkspacesResponse {
  workspaces: Workspace[]
  activeId: string | null
}

export const workspaceKeys = {
  all: ['workspaces'] as const,
}

export const useWorkspaces = () =>
  useQuery({
    queryKey: workspaceKeys.all,
    queryFn: async (): Promise<WorkspacesResponse> => {
      const { data } = await axios.get('/api/workspaces')
      return data
    },
    staleTime: 5 * 60 * 1000,
  })

export const useSetActiveWorkspace = (options?: { onError?: (e: unknown) => void }) =>
  useMutation({
    mutationFn: async (workspaceId: string) => {
      const { data } = await axios.patch('/api/workspaces', { workspaceId })
      return data
    },
    onSuccess: () => {
      // Cambiar de workspace cambia TODO lo que sirve el servidor (kanban, designers,
      // listas, settings…). Un reload completo es lo más seguro: re-lee todo con el
      // nuevo activo (el crawl de ClickUp ya cachea por workspaceId, así que sin fugas).
      window.location.reload()
    },
    onError: options?.onError,
  })
