/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/team/Team.tsx
'use client'

import React, { useState, useMemo } from 'react'
import { hotToast as toast } from '@/lib/hotToast'
import { TeamHeader } from './TeamHeader'
import { UsersList } from './UsersList'
import { CapacityTimeline } from './CapacityTimeline'
import { UserEditModal } from './UserEditModal'
import {
  useClickUpUsers,
  useSyncUsers,
} from '@/hooks/queries/useUsers'
import { useUsersWorkload } from '@/hooks/queries/useWorkload'

export const ClickUpUsersSync: React.FC = () => {
  // State
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [searchFilter, setSearchFilter] = useState('')
  const [editingUserId, setEditingUserId] = useState<string | null>(null)

  // Queries
  const {
    data: usersData,
    isLoading,
  } = useClickUpUsers()

  // Carga de trabajo de los diseñadores sincronizados (se cruza por id en UsersList).
  const { data: workload = [], isLoading: workloadLoading } = useUsersWorkload()

  // Mutations
  const { mutate: syncUsers, isPending: syncing } = useSyncUsers({
    onSuccess: (data) => {
      const { statistics, notFoundUsers, errors } = data

      let successMessage = `${statistics.created} users synced successfully`

      if (notFoundUsers && notFoundUsers.length > 0) {
        successMessage += ` (${notFoundUsers.length} not found in teams)`
      }

      if (errors && errors.length > 0) {
        successMessage += ` (${errors.length} errors)`
      }

      toast.success({ title: successMessage, description: 'Members are now available.' })

      if (notFoundUsers && notFoundUsers.length > 0) {
        toast.neutral({ title: `Users not found in teams: ${notFoundUsers.join(', ')}`, description: 'They were skipped.' })
      }

      if (errors && errors.length > 0) {
        console.warn('Errors during sync:', errors)
        toast.neutral({ title: 'Some users had errors. Check console for details.', description: 'The rest synced fine.' })
      }

      setSelectedUsers(new Set())
    },
    onError: (error: any) => {
      console.error('❌ Sync error:', error)
      const message = error.response?.data?.error || error.message
      toast.error({ title: 'Sync failed', description: message })
    },
  })

  // Computed values
  const clickupUsers = usersData?.clickupUsers || []
  
  const filteredUsers = useMemo(() => {
    return clickupUsers.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        user.email.toLowerCase().includes(searchFilter.toLowerCase())
      return matchesSearch
    })
  }, [clickupUsers, searchFilter])

  const availableUsers = useMemo(() => {
    return filteredUsers.filter((user) => user.canSync)
  }, [filteredUsers])

  const allAvailableSelected = useMemo(() => {
    return availableUsers.length > 0 &&
      availableUsers.every((user) => selectedUsers.has(user.clickupId))
  }, [availableUsers, selectedUsers])

  // Event handlers
  const handleUserSelection = (userId: string, checked: boolean) => {
    const newSelection = new Set(selectedUsers)

    if (checked) {
      newSelection.add(userId)
    } else {
      newSelection.delete(userId)
    }

    setSelectedUsers(newSelection)
  }

  const handleSelectAll = () => {
    if (allAvailableSelected) {
      const newSelection = new Set(selectedUsers)
      availableUsers.forEach((user) => newSelection.delete(user.clickupId))
      setSelectedUsers(newSelection)
    } else {
      const newSelection = new Set(selectedUsers)
      availableUsers.forEach((user) => newSelection.add(user.clickupId))
      setSelectedUsers(newSelection)
    }
  }

  const handleSync = () => {
    if (selectedUsers.size === 0) {
      toast.neutral({ title: 'Select at least one user to sync', description: 'Nothing selected yet.' })
      return
    }

    syncUsers(Array.from(selectedUsers))
  }

  const handleEditUser = (userId: string) => {
    setEditingUserId(userId)
  }

  return (
    <>
      <TeamHeader
        searchValue={searchFilter}
        onSearchChange={setSearchFilter}
      />

      <div className="p-6 flex-1 flex flex-col gap-8">
        <CapacityTimeline workload={workload} loading={workloadLoading} />

        <UsersList
          users={filteredUsers}
          selectedUsers={selectedUsers}
          onUserSelect={handleUserSelection}
          onUserEdit={handleEditUser}
          loading={isLoading}
          workload={workload}
          workloadLoading={workloadLoading}
          selectedCount={selectedUsers.size}
          availableCount={availableUsers.length}
          allAvailableSelected={allAvailableSelected}
          onSelectAll={handleSelectAll}
          onSync={handleSync}
          syncing={syncing}
        />
      </div>

      {/* Editor de miembro (autónomo: maneja su propio Modal + Save/Discard). */}
      <UserEditModal
        open={!!editingUserId}
        userId={editingUserId ?? ''}
        userName={clickupUsers.find((u) => u.clickupId === editingUserId)?.name}
        onClose={() => setEditingUserId(null)}
      />
    </>
  )
}