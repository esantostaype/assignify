import React from 'react'
import { Field } from 'formik'
import { Input } from '@/components/ui'
import { Typography } from '@/components/ui/typography'
import { Icon, PiNote } from '@/lib/icons'

interface TaskNameFieldProps {
  touched?: boolean
  error?: string
}

export const TaskNameField: React.FC<TaskNameFieldProps> = ({ touched, error }) => (
  <div>
    <Typography variant="label" className="flex items-center gap-1.5 mb-1.5">
      <Icon icon={PiNote} size={18} />
      Task Name
    </Typography>
    <Field
      as={Input}
      name="name"
      error={touched && error ? error : undefined}
      placeholder="Enter a Task Name"
    />
  </div>
)
