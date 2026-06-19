'use client'
// [SaaS fase 5] Wizard de onboarding para un workspace nuevo. Aparece SOLO si el
// workspace no fue marcado como onboarded Y aún le falta config (miembros/listas/tipos),
// así no molesta a workspaces ya configurados (p. ej. Inszone). Guía 3 pasos reutilizando
// componentes existentes; Skip/Finish marca el flag y no vuelve a aparecer.
import { useState } from 'react'
import axios from 'axios'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Modal, Stepper, Button } from '@/components/ui'
import { ListsSyncForm } from '@/components/ListsSyncForm'
import { TaskTypesForm } from '@/components/task-types/TaskTypesForm'
import { StepSyncMembers } from './StepSyncMembers'
import { useTaskData, taskDataKeys } from '@/hooks/useTaskData'

const STEPS = [
  { label: 'Members', description: 'Sync your ClickUp members' },
  { label: 'Lists', description: 'Pick assignable lists' },
  { label: 'Task types', description: 'Define your task types' },
]

export function OnboardingWizard() {
  const qc = useQueryClient()
  const [step, setStep] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const { data: completed } = useQuery({
    queryKey: ['onboarding'],
    queryFn: async () => (await axios.get('/api/onboarding')).data.completed as boolean,
    staleTime: 10 * 60 * 1000,
  })
  const { types, brands, users, loading } = useTaskData()

  // Esperamos a tener flag + data; no mostrar si ya está onboarded o ya está configurado.
  if (loading || completed === undefined || dismissed) return null
  const needsOnboarding = users.length === 0 || brands.length === 0 || types.length === 0
  if (completed || !needsOnboarding) return null

  const finish = async () => {
    setFinishing(true)
    try {
      await axios.patch('/api/onboarding', { completed: true })
      qc.invalidateQueries({ queryKey: ['onboarding'] })
      qc.invalidateQueries({ queryKey: taskDataKeys.all })
    } catch {
      /* no bloquear el cierre si el flag falla */
    }
    setFinishing(false)
    setDismissed(true)
  }

  const isLast = step === STEPS.length - 1

  return (
    <Modal
      open
      onClose={finish}
      title="Set up your workspace"
      description="A few quick steps to start assigning tasks."
      size="lg"
      staticBackdrop
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" color="neutral" onClick={finish} loading={finishing}>
            Skip for now
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outlined" color="neutral" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button onClick={finish} loading={finishing}>Finish</Button>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
            )}
          </div>
        </div>
      }
    >
      <Stepper steps={STEPS} active={step} className="mb-6" />
      <div className="min-h-[18rem]">
        {step === 0 && <StepSyncMembers />}
        {step === 1 && <ListsSyncForm />}
        {step === 2 && <TaskTypesForm />}
      </div>
    </Modal>
  )
}
