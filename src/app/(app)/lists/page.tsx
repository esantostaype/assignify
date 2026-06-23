import { ListsSyncForm } from '@/components/ListsSyncForm'
import { PageHeader } from '@/components/PageHeader'

// Página real de "Assignable Lists" (recarga / deep-link / mobile). En desktop se intercepta
// como modal (el título lo pone RouteModal). En vista de PÁGINA usa el mismo header que Tasks/Team.
export default function ListsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Assignable Lists" />
      <div className="p-6">
        <div className="mx-auto w-full max-w-2xl">
          <ListsSyncForm />
        </div>
      </div>
    </div>
  )
}
