// Importa el ARCHIVO (no el barrel '@/components/create-task'): el barrel re-exporta los
// campos (DurationField, etc.) que usan Formik, y al evaluarse en el server component dispara
// `createContext is not a function`. CreateTaskForm ('use client') aísla todo eso al cliente.
import { CreateTaskForm } from '@/components/create-task/CreateTaskForm'

// Página real de "Create Task" (deep-link / recarga / mobile). El padding y el título
// los pone el propio CreateTaskForm, así el overlay de "ocupado" cubre todo el panel.
export default function CreateTaskPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <CreateTaskForm />
    </div>
  )
}
