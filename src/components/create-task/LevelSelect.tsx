import React from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Medal02Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/shadcn/select'

interface LevelSelectProps {
  value: string
  onChange: (value: string) => void
  touched?: boolean
  error?: string
}

// Nivel solicitado. NO se persiste: solo decide a qué diseñador (Jr/Mid/Sr) escala la asignación.
const LEVEL_OPTIONS = [
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'MID', label: 'Mid' },
  { value: 'SENIOR', label: 'Senior' },
]

export const LevelSelect: React.FC<LevelSelectProps> = ({ value, onChange, touched, error }) => (
  <div>
    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
      <HugeiconsIcon icon={Medal02Icon} size={18} />
      Level
    </label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn(touched && error && 'ring-1 ring-destructive')}>
        <SelectValue placeholder="Select level" />
      </SelectTrigger>
      <SelectContent>
        {LEVEL_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {touched && error && <p className="mt-1 text-xs text-destructive">{error}</p>}
  </div>
)
