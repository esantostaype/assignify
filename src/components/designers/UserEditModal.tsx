// src/components/designers/UserEditModal.tsx - FIXED VERSION
import React from 'react'
import toast from 'react-hot-toast'
import { UserRoleRow } from './UserRoleRow'
import { UserVacationRow } from './UserVacationRow'
import { AddRoleForm } from './AddRoleForm'
import { AddVacationForm } from './AddVacationForm'
import { Icon, PiUser, PiCalendarBlank, PiMedal } from '@/lib/icons'
import { useUserDetails, useTaskTypes, useBrands, useUpdateUserLevel } from '@/hooks/queries/useUsers'
import { Alert, Select, type SelectOption } from '@/components/ui'

type UserLevel = 'JUNIOR' | 'MID' | 'SENIOR'

const LEVEL_OPTIONS: SelectOption<UserLevel>[] = [
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'MID', label: 'Mid' },
  { value: 'SENIOR', label: 'Senior' },
]

interface UserEditModalProps {
  userId: string
  onAddRole: (typeId: number, brandId?: string) => void
  onDeleteRole: (roleId: number) => void
  onAddVacation: (startDate: string, endDate: string) => void
  onDeleteVacation: (vacationId: number) => void
  loadingStates?: {
    addingRole?: boolean
    deletingRole?: number
    addingVacation?: boolean
    deletingVacation?: number
  }
}

export const UserEditModal: React.FC<UserEditModalProps> = ({
  userId,
  onAddRole,
  onDeleteRole,
  onAddVacation,
  onDeleteVacation,
  loadingStates = {}
}) => {
  const {
    data: user,
    isLoading: loadingUser,
    error: userError
  } = useUserDetails(userId)

  const {
    data: taskTypes = [],
    isLoading: loadingTypes,
    error: typesError
  } = useTaskTypes()

  const {
    data: brands = [],
    isLoading: loadingBrands,
    error: brandsError
  } = useBrands()

  const { mutate: updateLevel, isPending: updatingLevel } = useUpdateUserLevel(userId, {
    onSuccess: () => toast.success('Nivel actualizado'),
    onError: () => toast.error('Error al actualizar el nivel'),
  })

  // ✅ DEBUG: Log para verificar datos
  React.useEffect(() => {
    console.log('🔍 UserEditModal Debug:', {
      userId,
      user: user ? { id: user.id, name: user.name, rolesCount: user.roles?.length } : null,
      taskTypes: taskTypes?.length || 0,
      brands: brands?.length || 0,
      loading: { user: loadingUser, types: loadingTypes, brands: loadingBrands },
      errors: { user: userError, types: typesError, brands: brandsError }
    })
  }, [userId, user, taskTypes, brands, loadingUser, loadingTypes, loadingBrands, userError, typesError, brandsError])

  // ✅ Manejo mejorado de errores
  if (userError || typesError || brandsError) {
    return (
      <div className="p-6">
        <Alert tone="error" variant="soft">
          <div>
            <strong>Error loading data:</strong>
            <ul className="mt-2 text-sm">
              {userError && <li>User: {userError instanceof Error ? userError.message : 'Unknown error'}</li>}
              {typesError && <li>Task Types: {typesError instanceof Error ? typesError.message : 'Unknown error'}</li>}
              {brandsError && <li>Brands: {brandsError instanceof Error ? brandsError.message : 'Unknown error'}</li>}
            </ul>
          </div>
        </Alert>
      </div>
    )
  }

  if (!user && !loadingUser) {
    return (
      <div className="p-8 text-center text-(--color-text-subtle)">
        User not found
      </div>
    )
  }

  // ✅ Verificación adicional de datos
  if (!taskTypes || taskTypes.length === 0) {
    console.warn('⚠️ No task types loaded')
  }

  if (!brands || brands.length === 0) {
    console.warn('⚠️ No brands loaded')
  }

  const showRoleSkeleton = loadingUser || (user && user.roles?.length === 0 && loadingUser);
  const showVacationSkeleton = loadingUser || (user && user.vacations?.length === 0 && loadingUser);

  return (
    <div className="p-8 space-y-6">
      {/* Designer Level Section */}
      <div>
        <h3 className="text-lg font-medium text-(--color-text-strong) mb-2 flex items-center gap-2">
          <Icon icon={PiMedal} size={20} />
          Nivel del diseñador
        </h3>
        <div className="max-w-[16rem]">
          <Select<UserLevel>
            options={LEVEL_OPTIONS}
            value={(user?.level as UserLevel) ?? 'MID'}
            onChange={(value) => updateLevel(value)}
            disabled={loadingUser || updatingLevel}
            placeholder={loadingUser ? 'Loading...' : 'Select level'}
            size="sm"
          />
        </div>
        <p className="mt-1.5 text-sm text-(--color-text-subtle)">
          Decide el escalado de asignación automática (Jr → Mid → Sr).
        </p>
      </div>

      {/* Divider */}
      <div className="border-t border-(--color-border-default)" />

      {/* User Roles Section */}
      <div>
        <h3 className="text-lg font-medium text-(--color-text-strong) mb-2 flex items-center gap-2">
          <Icon icon={PiUser} size={20} />
          User Roles
        </h3>

        {/* Current Roles Table */}
        <div className="border border-(--color-border-default) rounded-lg overflow-hidden mb-4">
          <table className="w-full">
            <thead className="bg-(--color-surface-hover)">
              <tr>
                <th className="p-2 first:pl-4 last:pr-4 text-left text-sm font-medium text-gray-300">Type</th>
                <th className="p-2 first:pl-4 last:pr-4 text-left text-sm font-medium text-gray-300">Brand</th>
                <th className="p-2 first:pl-4 last:pr-4 text-left text-sm font-medium text-gray-300 w-[5rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {user && user.roles && user.roles.length > 0 && user.roles.map((role) => (
                <UserRoleRow
                  key={role.id}
                  role={role}
                  onDelete={onDeleteRole}
                  deleting={loadingStates.deletingRole === role.id}
                  loading={loadingUser}
                />
              ))}
              {(showRoleSkeleton || (user && user.roles.length === 0)) && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-(--color-text-subtle)">
                    {showRoleSkeleton ? 'Loading roles...' : 'No roles assigned'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add New Role Form */}
        <AddRoleForm
          taskTypes={taskTypes}
          brands={brands}
          onAdd={onAddRole}
          loading={loadingStates.addingRole}
          loadingTypes={loadingTypes}
          loadingBrands={loadingBrands}
        />
      </div>

      {/* Divider */}
      <div className="border-t border-(--color-border-default)" />

      {/* User Vacations Section */}
      <div>
        <h3 className="text-lg font-medium text-(--color-text-strong) mb-2 flex items-center gap-2">
          <Icon icon={PiCalendarBlank} size={20} />
          Vacations
        </h3>

        {/* Current Vacations Table */}
        <div className="border border-(--color-border-default) rounded-lg overflow-hidden mb-4">
          <table className="w-full">
            <thead className="bg-(--color-surface-hover)">
              <tr>
                <th className="p-2 first:pl-4 last:pr-4 text-left text-sm font-medium text-gray-300">Start Date</th>
                <th className="p-2 first:pl-4 last:pr-4 text-left text-sm font-medium text-gray-300">End Date</th>
                <th className="p-2 first:pl-4 last:pr-4 text-left text-sm font-medium text-gray-300">Duration</th>
                <th className="p-2 first:pl-4 last:pr-4 text-left text-sm font-medium text-gray-300 w-[5rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {user && user.vacations && user.vacations.length > 0 && user.vacations.map((vacation) => (
                <UserVacationRow
                  key={vacation.id}
                  vacation={vacation}
                  onDelete={onDeleteVacation}
                  deleting={loadingStates.deletingVacation === vacation.id}
                  loading={loadingUser}
                />
              ))}
              {(showVacationSkeleton || (user && user.vacations.length === 0)) && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-(--color-text-subtle)">
                    {showVacationSkeleton ? 'Loading vacations...' : 'No vacations scheduled'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ✅ NEW: Enhanced Add Vacation Form with conflict detection */}
        <AddVacationForm
          onAdd={onAddVacation}
          loading={loadingStates.addingVacation}
          existingVacations={user?.vacations || []}
          userId={userId}
        />
      </div>
    </div>
  )
}
