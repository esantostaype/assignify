import { TaskTypesForm } from '@/components'
import { PageHeader } from '@/components/PageHeader'

// Página real de "Task Types" (recarga / deep-link / mobile). En desktop se intercepta como
// modal (el título lo pone RouteModal). En vista de PÁGINA usa el mismo header que Tasks/Team.
export default function TypesPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Task Types" />
      <div className="p-6">
        <div className="mx-auto w-full max-w-2xl">
          <TaskTypesForm />
        </div>
      </div>
    </div>
  )
}
