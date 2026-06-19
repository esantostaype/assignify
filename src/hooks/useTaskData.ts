// src/hooks/useTaskData.ts - VERSIÓN CON REACT QUERY
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { TierInfo, TaskType, Brand, User } from '@/interfaces'
import type { DurationUnit } from '@/utils/duration-utils'

// Query keys para React Query
export const taskDataKeys = {
  all: ['task-data'] as const,
  types: () => [...taskDataKeys.all, 'types'] as const,
  brands: () => [...taskDataKeys.all, 'brands'] as const,
  users: () => [...taskDataKeys.all, 'users'] as const,
  tiers: () => [...taskDataKeys.all, 'tiers'] as const,
}

// Funciones de fetching
const fetchTypes = async (): Promise<TaskType[]> => {
  const response = await axios.get('/api/types')
  return response.data
}

const fetchBrands = async (): Promise<Brand[]> => {
  const response = await axios.get('/api/brands')
  return response.data.filter((brand: Brand) => brand.isActive)
}

const fetchUsers = async (): Promise<User[]> => {
  const response = await axios.get('/api/users')
  return response.data.filter((user: User) => user.active)
}

const fetchTiers = async (): Promise<{ tiers: TierInfo[]; durationUnit: DurationUnit }> => {
  const response = await axios.get('/api/tiers')
  return { tiers: response.data.tiers ?? [], durationUnit: response.data.durationUnit ?? 'days' }
}

export const useTaskData = () => {
  const queryClient = useQueryClient()

  // Queries individuales
  const {
    data: types = [],
    isLoading: typesLoading,
    error: typesError
  } = useQuery({
    queryKey: taskDataKeys.types(),
    queryFn: fetchTypes,
    staleTime: 5 * 60 * 1000, // 5 minutos
  })

  const {
    data: brands = [],
    isLoading: brandsLoading,
    error: brandsError
  } = useQuery({
    queryKey: taskDataKeys.brands(),
    queryFn: fetchBrands,
    staleTime: 5 * 60 * 1000,
  })

  const {
    data: users = [],
    isLoading: usersLoading,
    error: usersError
  } = useQuery({
    queryKey: taskDataKeys.users(),
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000,
  })

  const {
    data: tiersData = { tiers: [] as TierInfo[], durationUnit: 'days' as DurationUnit },
    isLoading: tiersLoading,
    error: tiersError
  } = useQuery({
    queryKey: taskDataKeys.tiers(),
    queryFn: fetchTiers,
    staleTime: 5 * 60 * 1000,
  })
  const tiers = tiersData.tiers
  const durationUnit = tiersData.durationUnit

  // Loading y error combinados
  const loading = typesLoading || brandsLoading || usersLoading || tiersLoading
  const error = typesError || brandsError || usersError || tiersError

  // Funciones de refresh
  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: taskDataKeys.all })
  }

  const refreshTypes = () => {
    queryClient.invalidateQueries({ queryKey: taskDataKeys.types() })
  }

  const refreshTiers = () => {
    queryClient.invalidateQueries({ queryKey: taskDataKeys.tiers() })
    // También invalidar types porque las categorías dependen de los tiers
    queryClient.invalidateQueries({ queryKey: taskDataKeys.types() })
  }

  const refreshBrands = () => {
    queryClient.invalidateQueries({ queryKey: taskDataKeys.brands() })
  }

  const refreshUsers = () => {
    queryClient.invalidateQueries({ queryKey: taskDataKeys.users() })
  }

  return {
    types,
    brands,
    users,
    tiers,
    durationUnit,
    loading,
    error,
    refreshData,
    refreshTypes,
    refreshTiers,
    refreshBrands,
    refreshUsers,
  }
}

// Hook para invalidar task data cache desde otros componentes
export const useTaskDataInvalidation = () => {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: taskDataKeys.all })
    },
    invalidateTypes: () => {
      queryClient.invalidateQueries({ queryKey: taskDataKeys.types() })
    },
    invalidateTiers: () => {
      queryClient.invalidateQueries({ queryKey: taskDataKeys.tiers() })
      queryClient.invalidateQueries({ queryKey: taskDataKeys.types() })
    },
    invalidateBrands: () => {
      queryClient.invalidateQueries({ queryKey: taskDataKeys.brands() })
    },
    invalidateUsers: () => {
      queryClient.invalidateQueries({ queryKey: taskDataKeys.users() })
    },
  }
}