import { RouteModal } from '@/components/RouteModal'
import { TaskTypesForm } from '@/components'

// Intercepta /types → modal (desktop).
export default function InterceptedTypes() {
  return (
    <RouteModal title="Task Types" description="Click a name to edit • Enter to save • Esc to cancel" size="md">
      <TaskTypesForm />
    </RouteModal>
  )
}
