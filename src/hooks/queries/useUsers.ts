/* eslint-disable @typescript-eslint/no-explicit-any */
// src/hooks/queries/useUsers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { workloadKeys } from './useWorkload'

// Types
interface ClickUpUser {
  clickupId: string
  name: string
  email: string
  profilePicture: string
  initials: string
  color: string
  role: string
  lastActive: string
  dateJoined: string
  existsInLocal: boolean
  canSync: boolean
}

interface UserSyncResponse {
  clickupUsers: ClickUpUser[]
  localUsers: any[]
  statistics: {
    totalClickUpUsers: number
    existingInLocal: number
    availableToSync: number
    totalLocalUsers: number
  }
  teams: any[]
}

type UserLevel = 'JUNIOR' | 'MID' | 'SENIOR'

interface DetailedUser {
  id: string
  name: string
  email: string
  active: boolean
  level: UserLevel
  roles: Array<{
    id: number
    userId: string
    typeId: number
    brandId?: string | null
    // Cargo primario (true) vs secundario (false) para este tipo de tarea.
    isPrimary: boolean
    type: {
      id: number
      name: string
    }
    brand?: {
      id: string
      name: string
    } | null
  }>
  vacations: Array<{
    id: number
    userId: string
    startDate: string
    endDate: string
  }>
}

interface TaskType {
  id: number
  name: string
}

interface Brand {
  id: string
  name: string
}

// Query Keys
export const userKeys = {
  all: ['users'] as const,
  clickup: () => [...userKeys.all, 'clickup'] as const,
  details: (userId: string) => [...userKeys.all, 'details', userId] as const,
  types: () => ['task-types'] as const,
  brands: () => ['brands'] as const,
}

// Queries
export const useClickUpUsers = () => {
  return useQuery({
    queryKey: userKeys.clickup(),
    queryFn: async (): Promise<UserSyncResponse> => {
      const { data } = await axios.get('/api/sync/clickup-users')
      return data
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - fresher for user management
  })
}

export const useUserDetails = (userId: string, enabled = true) => {
  return useQuery({
    queryKey: userKeys.details(userId),
    queryFn: async (): Promise<DetailedUser> => {
      const { data } = await axios.get(`/api/users/${userId}`)
      return data
    },
    enabled: enabled && !!userId,
    // El detalle alimenta el modal de edición, donde el usuario edita en vivo
    // (nivel, roles, vacaciones) y espera ver el cambio al instante. El
    // staleTime global de 5 min hacía que al reabrir mostrara datos viejos:
    // aquí forzamos que siempre esté fresco y se refetchee al montar.
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

export const useTaskTypes = () => {
  return useQuery({
    queryKey: userKeys.types(),
    queryFn: async (): Promise<TaskType[]> => {
      const { data } = await axios.get('/api/types')
      return data
    },
  })
}

export const useBrands = () => {
  return useQuery({
    queryKey: userKeys.brands(),
    queryFn: async (): Promise<Brand[]> => {
      const { data } = await axios.get('/api/brands')
      return data
    },
  })
}

// Mutations
export const useSyncUsers = (options?: {
  onSuccess?: (data: any) => void
  onError?: (error: any) => void
}) => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (userIds: string[]) => {
      const { data } = await axios.post('/api/sync/clickup-users', { userIds })
      return data
    },
    onSuccess: (data) => {
      // Invalidate and refetch users data
      queryClient.invalidateQueries({ queryKey: userKeys.clickup() })
      // …y la CARGA: sin esto las tarjetas recién sincronizadas se quedan en
      // skeleton (no llega su workload) hasta recargar la página a mano.
      queryClient.invalidateQueries({ queryKey: workloadKeys.all })
      options?.onSuccess?.(data)
    },
    onError: options?.onError,
  })
}

export const useAddUserRole = (options?: {
  onSuccess?: () => void
  onError?: (error: unknown) => void
}) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { userId: string; typeId: number; brandId?: string | null; isPrimary?: boolean }) => {
      const { userId, ...body } = payload
      const { data } = await axios.post(`/api/users/${userId}/roles`, body)
      return data
    },
    onSuccess: (_, variables) => {
      // Refresca el modal (detalle) y la tarjeta/lista (workload + clickup users),
      // que muestran roles/nivel/estado del diseñador.
      queryClient.invalidateQueries({ queryKey: userKeys.details(variables.userId) })
      queryClient.invalidateQueries({ queryKey: workloadKeys.all })
      queryClient.invalidateQueries({ queryKey: userKeys.clickup() })

      // Invalidación de los caches del motor de asignación.
      queryClient.invalidateQueries({ queryKey: ['task-suggestion'] })
      queryClient.invalidateQueries({ queryKey: ['compatible-users'] })
      queryClient.invalidateQueries({ queryKey: ['user-slots'] })
      queryClient.invalidateQueries({ queryKey: ['best-user-selection'] })
      queryClient.invalidateQueries({ queryKey: ['task-data'] })

      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

// Eliminación de rol con el userId en contexto para poder invalidar su detalle.
export const useDeleteUserRole = (userId: string, options?: {
  onSuccess?: () => void
  onError?: () => void
}) => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (roleId: number) => {
      await axios.delete(`/api/users/${userId}/roles/${roleId}`)
      return { roleId, userId }
    },
    onSuccess: (data) => {
      // Refresca el modal (detalle) y la tarjeta/lista (workload + clickup users).
      queryClient.invalidateQueries({ queryKey: userKeys.details(data.userId) })
      queryClient.invalidateQueries({ queryKey: workloadKeys.all })
      queryClient.invalidateQueries({ queryKey: userKeys.clickup() })

      // Invalidación de los caches del motor de asignación.
      queryClient.invalidateQueries({ queryKey: ['task-suggestion'] })
      queryClient.invalidateQueries({ queryKey: ['compatible-users'] })
      queryClient.invalidateQueries({ queryKey: ['user-slots'] })
      queryClient.invalidateQueries({ queryKey: ['best-user-selection'] })
      queryClient.invalidateQueries({ queryKey: ['task-data'] })

      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

// Alterna (o fija) el flag `isPrimary` de un rol. Como afecta a qué diseñador
// prefiere el motor, invalida también los caches de asignación.
export const useToggleUserRolePrimary = (userId: string, options?: {
  onSuccess?: () => void
  onError?: () => void
}) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { roleId: number; isPrimary: boolean }) => {
      const { data } = await axios.patch(`/api/users/${userId}/roles/${payload.roleId}`, {
        isPrimary: payload.isPrimary,
      })
      return data
    },
    onSuccess: (_, { roleId, isPrimary }) => {
      // Actualización OPTIMISTA: el Switch de la fila refleja `role.isPrimary`
      // desde esta query, así que lo escribimos al instante en vez de esperar
      // al refetch.
      queryClient.setQueryData<DetailedUser>(userKeys.details(userId), (old) =>
        old
          ? { ...old, roles: old.roles.map((r) => (r.id === roleId ? { ...r, isPrimary } : r)) }
          : old
      )

      // El cargo primario define el título del puesto que muestra la tarjeta:
      // refrescar detalle + workload + lista de usuarios.
      queryClient.invalidateQueries({ queryKey: userKeys.details(userId) })
      queryClient.invalidateQueries({ queryKey: workloadKeys.all })
      queryClient.invalidateQueries({ queryKey: userKeys.clickup() })

      queryClient.invalidateQueries({ queryKey: ['task-suggestion'] })
      queryClient.invalidateQueries({ queryKey: ['compatible-users'] })
      queryClient.invalidateQueries({ queryKey: ['user-slots'] })
      queryClient.invalidateQueries({ queryKey: ['best-user-selection'] })
      queryClient.invalidateQueries({ queryKey: ['task-data'] })

      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

export const useAddUserVacation = (options?: {
  onSuccess?: () => void
  onError?: () => void
}) => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: { userId: string; startDate: string; endDate: string }) => {
      const { userId, ...body } = payload
      const { data } = await axios.post(`/api/users/${userId}/vacations`, body)
      return data
    },
    onSuccess: (_, variables) => {
      // Refresca el modal (detalle) y la tarjeta (workload: estado "On vacation").
      queryClient.invalidateQueries({ queryKey: userKeys.details(variables.userId) })
      queryClient.invalidateQueries({ queryKey: workloadKeys.all })

      // Las vacaciones afectan la lógica de disponibilidad del motor.
      queryClient.invalidateQueries({ queryKey: ['task-suggestion'] })
      queryClient.invalidateQueries({ queryKey: ['user-slots'] })
      queryClient.invalidateQueries({ queryKey: ['best-user-selection'] })
      queryClient.invalidateQueries({ queryKey: ['vacation-aware'] })

      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

// Eliminación de vacación con el userId en contexto para invalidar su detalle.
export const useDeleteUserVacation = (userId: string, options?: {
  onSuccess?: () => void
  onError?: () => void
}) => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (vacationId: number) => {
      await axios.delete(`/api/users/${userId}/vacations/${vacationId}`)
      return { vacationId, userId }
    },
    onSuccess: (data) => {
      // Refresca el modal (detalle) y la tarjeta (workload: estado "On vacation").
      queryClient.invalidateQueries({ queryKey: userKeys.details(data.userId) })
      queryClient.invalidateQueries({ queryKey: workloadKeys.all })

      // Las vacaciones afectan la lógica de disponibilidad del motor.
      queryClient.invalidateQueries({ queryKey: ['task-suggestion'] })
      queryClient.invalidateQueries({ queryKey: ['user-slots'] })
      queryClient.invalidateQueries({ queryKey: ['best-user-selection'] })
      queryClient.invalidateQueries({ queryKey: ['vacation-aware'] })

      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}

// Actualiza el nivel del diseñador (Junior/Mid/Senior). Afecta la asignación automática.
export const useUpdateUserLevel = (userId: string, options?: {
  onSuccess?: () => void
  onError?: () => void
}) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (level: UserLevel) => {
      const { data } = await axios.patch(`/api/users/${userId}`, { level })
      return data
    },
    onSuccess: (_, level) => {
      // Actualización OPTIMISTA del detalle: el Select de nivel lee `user.level`
      // de esta query. Escribirla al instante evita depender del timing del
      // refetch (que podía repintar con el valor viejo aún en vuelo).
      queryClient.setQueryData<DetailedUser>(userKeys.details(userId), (old) =>
        old ? { ...old, level } : old
      )

      // El nivel se muestra en la tarjeta (p.ej. "Senior UX/UI"):
      // refrescar detalle + workload + lista de usuarios, y los caches del motor.
      queryClient.invalidateQueries({ queryKey: userKeys.details(userId) })
      queryClient.invalidateQueries({ queryKey: workloadKeys.all })
      queryClient.invalidateQueries({ queryKey: userKeys.clickup() })

      queryClient.invalidateQueries({ queryKey: ['task-suggestion'] })
      queryClient.invalidateQueries({ queryKey: ['user-slots'] })
      queryClient.invalidateQueries({ queryKey: ['best-user-selection'] })
      queryClient.invalidateQueries({ queryKey: ['task-data'] })

      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}