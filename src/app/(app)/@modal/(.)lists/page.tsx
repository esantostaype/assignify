import { RouteModal } from '@/components/RouteModal'
import { ListsSyncForm } from '@/components/ListsSyncForm'

// Intercepta /lists → modal (desktop).
export default function InterceptedLists() {
  return (
    <RouteModal title="Assignable Lists" description="Choose which ClickUp lists of your workspace can receive tasks" size="md">
      <ListsSyncForm />
    </RouteModal>
  )
}
