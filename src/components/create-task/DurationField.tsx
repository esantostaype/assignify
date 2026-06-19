/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react'
import { useFormikContext } from 'formik'
import { Input } from '@/components/ui'
import { Typography } from '@/components/ui/typography'
import { Icon, PiClock } from '@/lib/icons'
import { FormValues } from '@/interfaces'
import { formatDuration, unitToDays, type DurationUnit } from '@/utils/duration-utils'

interface DurationFieldProps {
  touched?: boolean
  error?: string
  onDurationComplete?: (duration: string) => void
  onDurationChange?: (duration: string) => void
  // Duración por defecto del tier seleccionado (EN LA UNIDAD del workspace).
  tierDuration?: number
  // Unidad de duración del workspace (días/horas/minutos). El valor del campo está en ESTA unidad.
  unit?: DurationUnit
}

export const DurationField: React.FC<DurationFieldProps> = ({
  touched,
  error,
  onDurationComplete,
  onDurationChange,
  tierDuration,
  unit = 'days',
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

  // La duración SIEMPRE viene del tier (instantáneo) o es manual: nunca se
  // "calcula". Por eso no hay estado de carga aquí (lo que tardaba era la
  // sugerencia de diseñador, no la duración).
  const getStatusIndicator = () => {
    if (isApplyingAutomatic) return { text: '(Applying...)', color: 'var(--color-primary-400)' }
    if (hasManualEdit) return { text: '(Manual)', color: 'var(--color-warning-500)' }
    if (localInputValue && tierDuration !== undefined && tierDuration.toString() === localInputValue) {
      return { text: '(From Tier)', color: 'var(--color-success-500)' }
    }
    return null
  }

  const statusIndicator = getStatusIndicator()

  // Texto de ayuda mostrado bajo el campo (vía la prop `helper` del Input de ui).
  // Mismo contenido que antes mostraba <TextFieldHelp>: duración efectiva por
  // usuario cuando hay varios asignados, o duración total cuando hay uno solo.
  let durationHelper: React.ReactNode = null
  if (numberOfAssignees > 1 && originalDuration > 0) {
    durationHelper = (
      <>
        Effective duration per user: <strong>{formatDuration(unitToDays(effectiveDuration, unit), unit)}</strong>
        <br />
        ({numberOfAssignees} users working in parallel)
      </>
    )
  } else if (numberOfAssignees === 1 && originalDuration > 0) {
    durationHelper = <>Total duration: {formatDuration(unitToDays(originalDuration, unit), unit)}</>
  }

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
      <Typography variant="label" className="flex items-center gap-1.5 mb-1.5">
        <Icon icon={PiClock} size={18} />
        Duration
        {statusIndicator && (
          <span style={{ color: statusIndicator.color, marginLeft: '4px' }}>
            {statusIndicator.text}
          </span>
        )}
      </Typography>

      <Input
        name="durationDays"
        type="number"
        value={localInputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder={`Duration in ${unit}`}
        error={touched && error ? error : undefined}
        helper={durationHelper}
        step={0.1}
      />
    </div>
  )
}
