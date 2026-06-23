import { CreateTaskForm } from '@/components/create-task'

// Página real de "Create Task" (deep-link / recarga / mobile). El padding y el título
// los pone el propio CreateTaskForm, así el overlay de "ocupado" cubre todo el panel.
export default function CreateTaskPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <CreateTaskForm />
    </div>
  )
}
