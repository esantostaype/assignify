import React from 'react'
import { Field } from 'formik'
import { HugeiconsIcon } from '@hugeicons/react'
import { Note01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { Input } from '@/components/shadcn/input'

interface TaskNameFieldProps {
  touched?: boolean
  error?: string
}

export const TaskNameField: React.FC<TaskNameFieldProps> = ({ touched, error }) => (
  <div>
    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
      <HugeiconsIcon icon={Note01Icon} size={18} />
      Task Name
    </label>
    <Field
      as={Input}
      name="name"
      placeholder="Enter a Task Name"
      className={cn(touched && error && 'ring-1 ring-destructive')}
    />
    {touched && error && <p className="mt-1 text-xs text-destructive">{error}</p>}
  </div>
)
