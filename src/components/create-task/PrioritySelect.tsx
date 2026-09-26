import React from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Flag02Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/shadcn/select'

interface PrioritySelectProps {
  value: string
  onChange: (value: string) => void
  touched?: boolean
  error?: string
}

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]

export const PrioritySelect: React.FC<PrioritySelectProps> = ({ value, onChange, touched, error }) => (
  <div>
    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
      <HugeiconsIcon icon={Flag02Icon} size={18} />
      Priority
    </label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn(touched && error && 'ring-1 ring-destructive')}>
        <SelectValue placeholder="Select priority" />
      </SelectTrigger>
      <SelectContent>
        {PRIORITY_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {touched && error && <p className="mt-1 text-xs text-destructive">{error}</p>}
  </div>
)
