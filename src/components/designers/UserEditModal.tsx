// src/components/designers/UserEditModal.tsx - FIXED VERSION
import React from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { UserRoleRow } from './UserRoleRow'
import { UserVacationRow } from './UserVacationRow'
import { AddRoleForm } from './AddRoleForm'
import { AddVacationForm } from './AddVacationForm'
import { Icon, PiUser, PiCalendarBlank, PiMedal } from '@/lib/icons'
import { useUserDetails, useTaskTypes, useBrands, useUpdateUserLevel, useAddUserRole, useToggleUserRolePrimary } from '@/hooks/queries/useUsers'
import { Alert, Select, type SelectOption } from '@/components/ui'

type UserLevel = 'JUNIOR' | 'MID' | 'SENIOR'

/**
 * Extrae el mensaje REAL que devuelve el servidor (el endpoint responde
 * `{ error, details? }`), p.ej. "Role already exists for this user" en un 409.
 * Antes el toast era genérico ("Error adding role") y ocultaba la causa.
 */
const serverErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; details?: string } | undefined
    return data?.error || data?.details || error.message || fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}

const LEVEL_OPTIONS: SelectOption<UserLevel>[] = [
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'MID', label: 'Mid' },
  { value: 'SENIOR', label: 'Senior' },
]

interface UserEditModalProps {
  userId: string
  /**
   * Compatibilidad con el wrapper de Designers. El alta de rol se gestiona
   * internamente (vía useAddUserRole) para poder enviar también `isPrimary`,
   * así que esta prop ya no se usa directamente para crear el rol.
   */
  onAddRole?: (typeId: number, brandId?: string, isPrimary?: boolean) => void
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
    onSuccess: () => toast.success('Level updated'),
    onError: () => toast.error('Error updating level'),
  })

  // Alta de rol gestionada aquí para poder enviar también `isPrimary`.
  const { mutate: addRole, isPending: addingRole } = useAddUserRole({
    onSuccess: () => toast.success('Role added successfully'),
    // Muestra el mensaje real del servidor (p.ej. "Role already exists for this
    // user" en un 409) en lugar del genérico, para que los errores sean visibles.
    onError: (error) => toast.error(serverErrorMessage(error, 'Error adding role')),
  })

  // Alterna el cargo primario/secundario de un rol existente.
  const { mutate: togglePrimary, isPending: togglingPrimary, variables: togglingVars } =
    useToggleUserRolePrimary(userId, {
      onError: () => toast.error('Error updating primary role'),
    })

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

  const showRoleSkeleton = loadingUser || (user && user.roles?.length === 0 && loadingUser);
  const showVacationSkeleton = loadingUser || (user && user.vacations?.length === 0 && loadingUser);

  return (
    <div className="space-y-6">
      {/* Designer Level Section */}
      <div>
        <h3 className="text-lg font-medium text-(--color-text-strong) mb-2 flex items-center gap-2">
          <Icon icon={PiMedal} size={20} />
          Designer Level
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
          Drives auto-assignment escalation (Jr → Mid → Sr).
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
                <th className="p-2 first:pl-4 last:pr-4 text-left text-sm font-medium text-gray-300">Primary</th>
                <th className="p-2 first:pl-4 last:pr-4 text-left text-sm font-medium text-gray-300 w-[5rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {user && user.roles && user.roles.length > 0 && user.roles.map((role) => (
                <UserRoleRow
                  key={role.id}
                  role={role}
                  onDelete={onDeleteRole}
                  onTogglePrimary={(roleId, isPrimary) => togglePrimary({ roleId, isPrimary })}
                  deleting={loadingStates.deletingRole === role.id}
                  togglingPrimary={togglingPrimary && togglingVars?.roleId === role.id}
                  loading={loadingUser}
                />
              ))}
              {(showRoleSkeleton || (user && user.roles.length === 0)) && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-(--color-text-subtle)">
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
          onAdd={(typeId, brandId, isPrimary) =>
            addRole({ userId, typeId, brandId: brandId || null, isPrimary })
          }
          loading={addingRole || loadingStates.addingRole}
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
