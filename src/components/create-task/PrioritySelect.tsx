import React from 'react'
import { Select } from '@/components/ui'
import { Typography } from '@/components/ui/typography'
import { Icon, PiTarget } from '@/lib/icons'
import { TextFieldError } from '@/components'

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

export const PrioritySelect: React.FC<PrioritySelectProps> = ({
  value,
  onChange,
  touched,
  error
}) => (
  <div>
    <Typography variant="label" className="flex items-center gap-1.5 mb-1.5">
      <Icon icon={PiTarget} size={18} />
      Priority
    </Typography>
    <Select
      value={value}
      onChange={(val) => onChange(val)}
      placeholder="Normal"
      options={PRIORITY_OPTIONS}
      invalid={touched && !!error}
    />
    { touched && error && ( <TextFieldError label={ error } /> )}
</div>
)
