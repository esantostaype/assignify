import { SettingsForm } from '@/components'

export default function PageSettings() {
  return (
    <div className="flex flex-col">
      <div className="sticky top-16 z-50 bg-(--color-surface-app)/70 backdrop-blur-lg">
        <div className="flex items-center gap-2 border-b border-(--color-border-default) p-4">
          <h1 className="text-xl text-(--color-text-strong)">Settings</h1>
        </div>
      </div>
      <div className="p-6">
        <div className="mx-auto max-w-4xl">
          <SettingsForm />
        </div>
      </div>
    </div>
  )
}
