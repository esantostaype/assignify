import { SettingsForm } from '@/components'
import { PageHeader } from '@/components/PageHeader'

export default function PageSettings() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Settings" description="Work schedule, assignment rules, tiers and holidays." />
      {/* flex-1 en toda la cadena para que el estado de carga del form se centre en el
          área de contenido (no en todo el alto del site). */}
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
          <SettingsForm />
        </div>
      </div>
    </div>
  )
}
