/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react'
import { useFormikContext } from 'formik'
import { FormLabel, Input } from '@mui/joy'
import { HugeiconsIcon } from '@hugeicons/react'
import { DateTimeIcon } from '@hugeicons/core-free-icons'
import { FormValues } from '@/interfaces'
import { formatDaysToReadable } from '@/utils/duration-utils'
import { TextFieldError, TextFieldHelp } from '@/components'

interface DurationFieldProps {
  fetchingSuggestion: boolean
  touched?: boolean
  error?: string
  onDurationComplete?: (duration: string) => void
  onDurationChange?: (duration: string) => void
  // Duración por defecto del tier seleccionado (para indicar la fuente del valor).
  tierDuration?: number
}

export const DurationField: React.FC<DurationFieldProps> = ({
  fetchingSuggestion,
  touched,
  error,
  onDurationComplete,
  onDurationChange,
  tierDuration,
}) => {
  const { values, setFieldValue } = useFormikContext<FormValues>()

  const [localInputValue, setLocalInputValue] = React.useState('')
  const [hasManualEdit, setHasManualEdit] = React.useState(false)
  const [isApplyingAutomatic, setIsApplyingAutomatic] = React.useState(false)

  const numberOfAssignees = values.assignedUserIds.length
  const originalDuration = parseFloat(localInputValue) || 0
  const effectiveDuration = numberOfAssignees > 0 ? originalDuration / numberOfAssignees : originalDuration

  // Sincronizar con Formik cuando el valor cambia externamente (ej. al elegir tier).
  React.useEffect(() => {
    const currentFormikValue = (values.durationDays as string) || ''
    if (currentFormikValue !== localInputValue && !hasManualEdit) {
      setIsApplyingAutomatic(true)
      setLocalInputValue(currentFormikValue)
      setTimeout(() => setIsApplyingAutomatic(false), 100)
    }
  }, [values.durationDays, hasManualEdit, localInputValue])

  // Resetear el flag de edición manual cuando cambia el tier.
  React.useEffect(() => {
    setHasManualEdit(false)
  }, [values.tierId])

  const getStatusIndicator = () => {
    if (isApplyingAutomatic) return { text: '(Applying...)', color: 'var(--joy-palette-primary-400)' }
    if (hasManualEdit) return { text: '(Manual)', color: 'var(--joy-palette-warning-500)' }
    if (fetchingSuggestion) return { text: '(Calculating...)', color: 'var(--joy-palette-primary-500)' }
    if (localInputValue && tierDuration !== undefined && tierDuration.toString() === localInputValue) {
      return { text: '(From Tier)', color: 'var(--joy-palette-success-500)' }
    }
    return null
  }

  const statusIndicator = getStatusIndicator()

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value
    setLocalInputValue(newValue)
    setFieldValue('durationDays', newValue)

    if (!isApplyingAutomatic && newValue.trim() !== '') {
      if (tierDuration === undefined || newValue !== tierDuration.toString()) {
        setHasManualEdit(true)
      }
    }

    if (onDurationChange && newValue.trim() && !isApplyingAutomatic) {
      const duration = parseFloat(newValue)
      if (duration > 0) onDurationChange(newValue)
    }
  }

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (!event || !event.target) return
    const value = event.target.value.trim()
    if (onDurationComplete && value && !isApplyingAutomatic) {
      const durationValue = parseFloat(value)
      if (durationValue > 0) onDurationComplete(value)
    }
  }

  return (
    <div>
      <FormLabel>
        <HugeiconsIcon icon={DateTimeIcon} size={20} strokeWidth={1.5} />
        Duration
        {statusIndicator && (
          <span style={{ color: statusIndicator.color, marginLeft: '4px' }}>
            {statusIndicator.text}
          </span>
        )}
      </FormLabel>

      <Input
        name="durationDays"
        type="number"
        value={localInputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder={fetchingSuggestion ? 'Calculating suggested duration...' : 'Duration in days'}
        error={touched && !!error}
        slotProps={{ input: { step: 0.1 } }}
      />

      {numberOfAssignees > 1 && originalDuration > 0 && (
        <TextFieldHelp>
          Effective duration per user: <strong>{formatDaysToReadable(effectiveDuration)}</strong>
          <br />
          ({numberOfAssignees} users working in parallel)
        </TextFieldHelp>
      )}

      {numberOfAssignees === 1 && originalDuration > 0 && (
        <TextFieldHelp>
          Total duration: {formatDaysToReadable(originalDuration)}
        </TextFieldHelp>
      )}

      {touched && error && <TextFieldError label={error} />}
    </div>
  )
}
