// src/hooks/useTaskSuggestion.ts - VERSIÓN MEJORADA CON RE-CÁLCULO AUTOMÁTICO

import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { hotToast as toast } from '@/lib/hotToast'
import { SuggestedAssignment } from '@/interfaces'

export const useTaskSuggestion = (
  typeId: number | undefined,
  durationDays: string,
  brandId?: string,
  priority?: string,
  triggerSuggestion?: number,
  level?: string
) => {
  const [suggestedAssignment, setSuggestedAssignment] = useState<SuggestedAssignment | null>(null)
  const [fetchingSuggestion, setFetchingSuggestion] = useState(false)

  // ✅ NUEVO: Referencias para detectar cambios y debouncing
  const lastValidSuggestion = useRef<SuggestedAssignment | null>(null)
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)
  const lastParams = useRef<string>('')

  // ✅ NUEVO: Función para determinar si los parámetros son válidos
  const areParamsValid = (typeId: number | undefined, durationDays: string) => {
    if (!typeId || !durationDays) return false
    const duration = parseFloat(durationDays)
    return !isNaN(duration) && duration > 0
  }

  // ✅ NUEVO: Función para crear clave de parámetros para detectar cambios
  const createParamsKey = (typeId: number | undefined, durationDays: string, brandId?: string) => {
    return `${typeId || 'none'}-${durationDays || 'none'}-${brandId || 'global'}-${priority || 'NORMAL'}-${level || 'MID'}`
  }

  // Suggestion fetching with debouncing
  const getSuggestion = async (immediate = false) => {
    const currentParams = createParamsKey(typeId, durationDays, brandId)

    // Validar parámetros
    if (!areParamsValid(typeId, durationDays)) {
      setFetchingSuggestion(false)
      // No limpiar la sugerencia inmediatamente, esperar a que llegue una duración válida
      return
    }

    const duration = parseFloat(durationDays)
    lastParams.current = currentParams

    // ✅ NUEVO: Implementar debouncing solo para cambios de duración manual
    if (!immediate && debounceTimeout.current) {
      clearTimeout(debounceTimeout.current)
    }

    const executeSuggestion = async () => {
      setFetchingSuggestion(true)

      try {
        const params: Record<string, string | number> = {
          typeId: typeId ?? 0,
          durationDays: duration,
          priority: priority || 'NORMAL',
          level: level || 'MID'
        }

        if (brandId) {
          params.brandId = brandId
        }

        const response = await axios.get(`/api/tasks/suggestion/simple`, {
          params
        })

        const { suggestedUserId } = response.data

        const newSuggestion: SuggestedAssignment = {
          userId: suggestedUserId,
          durationDays: duration,
        }

        setSuggestedAssignment(newSuggestion)
        lastValidSuggestion.current = newSuggestion
      } catch (error) {
        setSuggestedAssignment(null)

        if (axios.isAxiosError(error)) {
          // 400 = validation error while typing: stay quiet, no toast.
          if (error.response?.status !== 400) {
            toast.error({ title: 'Failed to get assignment suggestion.', description: 'No designer suggested.' })
          }
        }
      } finally {
        setFetchingSuggestion(false)
      }
    }

    // ✅ NUEVO: Ejecutar inmediatamente o con debounce
    if (immediate) {
      await executeSuggestion()
    } else {
      // Debounce de 300ms para cambios de duración manual
      debounceTimeout.current = setTimeout(executeSuggestion, 300)
    }
  }

  // ✅ MEJORADO: Effect principal con mejor detección de cambios
  useEffect(() => {
    const currentParams = createParamsKey(typeId, durationDays, brandId)
    const paramsChanged = currentParams !== lastParams.current
    const shouldTriggerImmediate = triggerSuggestion !== undefined && triggerSuggestion > 0

    if (paramsChanged || shouldTriggerImmediate) {
      getSuggestion(shouldTriggerImmediate)
    }

    // Cleanup timeout on unmount
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }
    }
  }, [typeId, durationDays, brandId, priority, triggerSuggestion, level])

  // Force an immediate recalculation
  const forceSuggestionUpdate = () => {
    getSuggestion(true)
  }

  return {
    suggestedAssignment,
    fetchingSuggestion,
    forceSuggestionUpdate
  }
}