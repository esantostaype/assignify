// src/validation/taskValidation.ts — modelo Tarea = Tipo + Tier (sin categorías)

import * as Yup from 'yup'

export const validationSchema = Yup.object({
  name: Yup.string()
    .required('Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),

  description: Yup.string()
    .max(500, 'Description must be less than 500 characters'),

  // Tier requerido (define los días de la tarea)
  tierId: Yup.string().required('Tier is required'),

  priority: Yup.string()
    .oneOf(['LOW', 'NORMAL', 'HIGH', 'URGENT'], 'Invalid priority')
    .required('Priority is required'),

  // Nivel solicitado (Jr/Mid/Sr). No se persiste: solo decide el diseñador.
  level: Yup.string()
    .oneOf(['JUNIOR', 'MID', 'SENIOR'], 'Invalid level')
    .required('Level is required'),

  brandId: Yup.string()
    .required('Brand is required'),

  assignedUserIds: Yup.array()
    .of(Yup.string())
    .min(1, 'You must assign at least one user')
    .max(5, 'Maximum 5 users can be assigned')
    .required('User assignment is required'),

  durationDays: Yup.string()
    .test(
      'is-valid-duration',
      'Duration must be greater than 0',
      (value) => {
        if (!value) return false
        const num = parseFloat(value)
        return !isNaN(num) && num > 0
      }
    )
    .required('Duration is required'),
})
