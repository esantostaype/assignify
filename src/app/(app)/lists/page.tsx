import { ListsSyncForm } from '@/components/ListsSyncForm'

// Página real de "Assignable Lists" (recarga / mobile). En desktop se intercepta como modal.
export default function ListsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <h1 className="mb-5 text-xl font-semibold text-(--color-text-strong)">Assignable Lists</h1>
      <ListsSyncForm />
    </div>
  )
}
