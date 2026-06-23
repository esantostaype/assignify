import { CreateTaskForm } from '@/components/create-task'

// Página real de "Create Task" (deep-link / recarga / mobile). En desktop, al navegar
// desde la app se intercepta y se muestra como modal (ver @modal/(.)create).
export default function CreateTaskPage() {
  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <h1 className="mb-5 text-xl font-semibold text-(--color-text-strong)">Create Task</h1>
      <CreateTaskForm />
    </div>
  )
}
