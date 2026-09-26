import React from 'react'
import { SearchBar } from './SearchBar'
import { PageHeader } from '@/components/PageHeader'

interface TeamHeaderProps {
  searchValue: string
  onSearchChange: (value: string) => void
}

// Cabecera del Team vía la cabecera unificada (PageHeader): título + descripción +
// buscador a la derecha. Las acciones de sync viven en la sección "Available to sync".
export const TeamHeader: React.FC<TeamHeaderProps> = ({ searchValue, onSearchChange }) => {
  return (
    <PageHeader
      title="Team"
      description="Sync designers from ClickUp and manage their capacity."
      actions={
        <div className="w-full sm:w-64">
          <SearchBar value={searchValue} onChange={onSearchChange} />
        </div>
      }
    />
  )
}
