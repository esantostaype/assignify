// src/hooks/useTaskSuggestion.ts
// Sugerencia de diseñador + lista de candidatos (con su estado) en UNA sola
// llamada a /api/tasks/suggestion/simple. Es la única fuente de verdad para el
// selector de asignación: el "sugerido" y las opciones salen del mismo motor.

import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { hotToast as toast } from '@/lib/hotToast'
import { SuggestedAssignment, RankedCandidate } from '@/interfaces'

export const useTaskSuggestion = (
  typeId: number | undefined,
  durationDays: string,
  brandId?: string,
  priority?: string,
  triggerSuggestion?: number,
  level?: string
) => {
  const [suggestedAssignment, setSuggestedAssignment] = useState<SuggestedAssignment | null>(null)
  const [candidates, setCandidates] = useState<RankedCandidate[]>([])
  const [fetchingSuggestion, setFetchingSuggestion] = useState(false)

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)
  const lastParams = useRef<string>('')

  // Solo se sugiere cuando TODOS los campos requeridos del formulario están puestos:
  // tipo, lista (brand), tier/duración, nivel y prioridad. Antes bastaban tipo +
  // duración, así que sugería con el formulario a medio llenar.
  const areParamsValid = (typeId: number | undefined, durationDays: string) => {
    if (!typeId || !durationDays || !brandId || !priority || !level) return false
    const duration = parseFloat(durationDays)
    return !isNaN(duration) && duration > 0
  }

  // Clave de parámetros para detectar cambios reales (evita refetch innecesario).
  const createParamsKey = (typeId: number | undefined, durationDays: string, brandId?: string) =>
    `${typeId || 'none'}-${durationDays || 'none'}-${brandId || 'global'}-${priority || 'NORMAL'}-${level || 'MID'}`

  const getSuggestion = async (immediate = false) => {
    const currentParams = createParamsKey(typeId, durationDays, brandId)

    if (!areParamsValid(typeId, durationDays)) {
      setFetchingSuggestion(false)
      // Falta algún campo requerido → no hay sugerencia: la limpiamos para no
      // mostrar una parcial ni la vieja (tras resetear el form o al borrar un campo).
      setSuggestedAssignment(null)
      setCandidates([])
      lastParams.current = createParamsKey(typeId, durationDays, brandId)
      return
    }

    const duration = parseFloat(durationDays)
    lastParams.current = currentParams

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
          level: level || 'MID',
        }
        if (brandId) params.brandId = brandId

        const response = await axios.get(`/api/tasks/suggestion/simple`, { params })
        const { suggestedUserId, candidates: nextCandidates } = response.data as {
          suggestedUserId: string | null
          candidates: RankedCandidate[]
        }

        setCandidates(nextCandidates ?? [])
        setSuggestedAssignment(
          suggestedUserId ? { userId: suggestedUserId, durationDays: duration } : null
        )
      } catch (error) {
        setSuggestedAssignment(null)
        setCandidates([])

        // 400 = parámetros incompletos mientras se escribe: sin toast.
        if (axios.isAxiosError(error) && error.response?.status !== 400) {
          toast.error({ title: 'Failed to get assignment suggestion.', description: 'No member suggested.' })
        }
      } finally {
        setFetchingSuggestion(false)
      }
    }

    if (immediate) {
      await executeSuggestion()
    } else {
      debounceTimeout.current = setTimeout(executeSuggestion, 300)
    }
  }

  useEffect(() => {
    const currentParams = createParamsKey(typeId, durationDays, brandId)
    const paramsChanged = currentParams !== lastParams.current
    const shouldTriggerImmediate = triggerSuggestion !== undefined && triggerSuggestion > 0

    if (paramsChanged || shouldTriggerImmediate) {
      getSuggestion(shouldTriggerImmediate)
    }

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId, durationDays, brandId, priority, triggerSuggestion, level])

  // Sugerencia VIVA: si otro usuario crea/cambia tareas (evento realtime de Pusher),
  // recalcula para reflejar la carga actual del equipo. Solo si el formulario ya
  // tiene todos los datos válidos; usa el debounce para no spamear ante ráfagas.
  useEffect(() => {
    const onExternalChange = () => {
      if (areParamsValid(typeId, durationDays)) getSuggestion()
    }
    window.addEventListener('assignify:tasks-changed', onExternalChange)
    return () => window.removeEventListener('assignify:tasks-changed', onExternalChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId, durationDays, brandId, priority, level])

  return {
    suggestedAssignment,
    candidates,
    fetchingSuggestion,
  }
}
