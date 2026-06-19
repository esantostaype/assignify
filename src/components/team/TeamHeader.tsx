import React from 'react'
import { ActionBar } from './ActionBar'

interface TeamHeaderProps {
  searchValue: string
  onSearchChange: (value: string) => void
  selectedCount: number
  availableCount: number
  allAvailableSelected: boolean
  onSelectAll: () => void
  onSync: () => void
  onRefresh: () => void
  loading?: boolean
  syncing?: boolean
}

export const TeamHeader: React.FC<TeamHeaderProps> = (props) => {
  return (
    <div className="sticky top-16 p-4 bg-(--color-surface-app)/70 backdrop-blur-lg z-50 border-b border-b-(--color-border-default)">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl">
          Team
        </h1>
        <ActionBar {...props} />
      </div>
    </div>
  )
}
