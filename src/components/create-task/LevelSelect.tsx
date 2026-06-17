import React from 'react'
import { Select } from '@/components/ui'
import { Typography } from '@/components/ui/typography'
import { Icon, PiMedal } from '@/lib/icons'

interface LevelSelectProps {
  value: string
  onChange: (value: string) => void
  touched?: boolean
  error?: string
}

// Nivel solicitado para la tarea. NO se persiste en la tarea: solo decide a qué
// diseñador (Jr/Mid/Sr) se escala la asignación automática.
const LEVEL_OPTIONS = [
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'MID', label: 'Mid' },
  { value: 'SENIOR', label: 'Senior' },
]

export const LevelSelect: React.FC<LevelSelectProps> = ({
  value,
  onChange,
  touched,
  error,
}) => (
  <div>
    <Typography variant="label" className="flex items-center gap-1.5 mb-1.5">
      <Icon icon={PiMedal} size={18} />
      Nivel
    </Typography>
    <Select
      value={value}
      onChange={(val) => onChange(val)}
      placeholder="Mid"
      options={LEVEL_OPTIONS}
      error={touched && error ? error : undefined}
    />
  </div>
)
