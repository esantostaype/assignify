import { CreateTaskModal } from '@/components/create-task/CreateTaskModal'

// Intercepta /create al navegar desde la app → modal (desktop). Recargar /create
// directo muestra la página real ((app)/create/page.tsx).
export default function InterceptedCreate() {
  return <CreateTaskModal />
}
