import React from 'react'
import { SearchBar } from './SearchBar'
import { PageHeader } from '@/components/PageHeader'

interface TeamHeaderProps {
  searchValue: string
  onSearchChange: (value: string) => void
}

// Franja superior del Team: título + buscador, vía la cabecera unificada (PageHeader).
// Los botones Select Available / Sync viven en la cabecera de la sección
// "Available to sync" (ver UsersList).
export const TeamHeader: React.FC<TeamHeaderProps> = ({ searchValue, onSearchChange }) => {
  return (
    <PageHeader title="Team">
      <SearchBar value={searchValue} onChange={onSearchChange} />
    </PageHeader>
  )
}
