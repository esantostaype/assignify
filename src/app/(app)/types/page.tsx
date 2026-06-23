import { TaskTypesForm } from '@/components'

// Página real de "Task Types" (recarga / mobile). En desktop se intercepta como modal.
export default function TypesPage() {
  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <h1 className="mb-5 text-xl font-semibold text-(--color-text-strong)">Task Types</h1>
      <TaskTypesForm />
    </div>
  )
}
