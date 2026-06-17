import React from 'react'
import { ActionBar } from './ActionBar'
import { Icon, PiUsersThree } from '@/lib/icons'

interface DesignersHeaderProps {
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

export const DesignersHeader: React.FC<DesignersHeaderProps> = (props) => {
  return (
    <div className="sticky top-16 p-4 bg-(--color-surface-app)/70 backdrop-blur-lg z-50 border-b border-b-(--color-border-default)">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-medium">
          <Icon icon={PiUsersThree} size={32} />
          Designers
        </h1>
        <ActionBar {...props} />
      </div>
    </div>
  )
}
