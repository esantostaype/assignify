import React from 'react'
import { SearchBar } from './SearchBar'

interface TeamHeaderProps {
  searchValue: string
  onSearchChange: (value: string) => void
}

// Franja superior del Team: solo el título + el buscador (mismo patrón que Tasks).
// Los botones Select Available / Sync viven en la cabecera de la sección
// "Available to sync" (ver UsersList).
export const TeamHeader: React.FC<TeamHeaderProps> = ({ searchValue, onSearchChange }) => {
  return (
    <div className="sticky top-16 p-4 bg-(--color-surface-app)/70 backdrop-blur-lg z-50 border-b border-b-(--color-border-default)">
      <div className="flex items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 text-xl">Team</h1>
        <SearchBar value={searchValue} onChange={onSearchChange} className="w-full max-w-sm" />
      </div>
    </div>
  )
}
