'use client'
// Modal de creación para la ruta interceptada (/create en desktop). Tras crear con éxito,
// CreateTaskForm llama onCreated → router.back() para cerrar el modal.
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui'
import { CreateTaskForm } from './CreateTaskForm'

export function CreateTaskModal() {
  const router = useRouter()
  return (
    <Modal open onClose={() => router.back()} title="Create Task" size="lg">
      <CreateTaskForm onCreated={() => router.back()} />
    </Modal>
  )
}
