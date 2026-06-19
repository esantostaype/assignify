// src/components/team/UserEditModal.tsx - FIXED VERSION
import React from 'react'
import axios from 'axios'
import { hotToast as toast } from '@/lib/hotToast'
import { UserRoleRow } from './UserRoleRow'
import { UserVacationRow } from './UserVacationRow'
import { AddRoleForm } from './AddRoleForm'
import { AddVacationForm } from './AddVacationForm'
import { Icon, PiUser, PiCalendarBlank, PiMedal, PiUserCheck, PiTrash } from '@/lib/icons'
import { useUserDetails, useTaskTypes, useBrands, useUpdateUserLevel, useAddUserRole, useToggleUserRolePrimary, useSetUserActive, useRemoveUser } from '@/hooks/queries/useUsers'
import { Alert, Select, Button, DeleteConfirmDialog, type SelectOption } from '@/components/ui'

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
   * Compatibilidad con el wrapper del equipo. El alta de rol se gestiona
   * internamente (vía useAddUserRole) para poder enviar también `isPrimary`,
   * así que esta prop ya no se usa directamente para crear el rol.
   */
  onAddRole?: (typeId: number, brandId?: string, isPrimary?: boolean) => void
  onDeleteRole: (roleId: number) => void
  onAddVacation: (startDate: string, endDate: string) => void
  onDeleteVacation: (vacationId: number) => void
  /** Cierra el modal tras desincronizar al miembro (ya no existe que editar). */
  onRemoved?: () => void
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
  onRemoved,
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
    onSuccess: () => toast.success({ title: 'Level updated', description: 'Auto-assignment recalculated.' }),
    onError: () => toast.error({ title: 'Error updating level', description: 'The level was not changed.' }),
  })

  // Alta de rol gestionada aquí para poder enviar también `isPrimary`.
  const { mutate: addRole, isPending: addingRole } = useAddUserRole({
    onSuccess: () => toast.success({ title: 'Role added successfully', description: 'Assigned to the member.' }),
    // Muestra el mensaje real del servidor (p.ej. "Role already exists for this
    // user" en un 409) en lugar del genérico, para que los errores sean visibles.
    onError: (error) => toast.error({ title: "Couldn't add role", description: serverErrorMessage(error, 'Error adding role') }),
  })

  // Alterna el cargo primario/secundario de un rol existente.
  const { mutate: togglePrimary, isPending: togglingPrimary, variables: togglingVars } =
    useToggleUserRolePrimary(userId, {
      onSuccess: () => toast.success({ title: 'Primary role updated', description: 'Engine preference updated.' }),
      onError: () => toast.error({ title: 'Error updating primary role', description: 'The change was not saved.' }),
    })

  // Activar/desactivar al miembro (sigue en el equipo; el motor lo ignora si está inactivo).
  const { mutate: setActive, isPending: settingActive } = useSetUserActive(userId, {
    onSuccess: () => toast.success({ title: 'Member updated', description: 'Availability recalculated.' }),
    onError: () => toast.error({ title: 'Error updating member', description: 'The change was not saved.' }),
  })

  // Desincronizar (quitar) al miembro del workspace.
  const { mutate: removeUser, isPending: removing } = useRemoveUser(userId, {
    onSuccess: () => {
      toast.success({ title: 'Member removed', description: 'Desynced from this workspace.' })
      onRemoved?.()
    },
    onError: () => toast.error({ title: "Couldn't remove member", description: 'They are still on the team.' }),
  })

  // Confirmación inline para el borrado (evita un modal anidado dentro del modal de edición).
  const [confirmingRemove, setConfirmingRemove] = React.useState(false)

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
      {/* Member Level Section */}
      <div>
        <h3 className="text-lg font-medium text-(--color-text-strong) mb-2 flex items-center gap-2">
          <Icon icon={PiMedal} size={20} />
          Level
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

      {/* Divider */}
      <div className="border-t border-(--color-border-default)" />

      {/* Membership Section: activar/desactivar + desincronizar del equipo */}
      <div>
        <h3 className="text-lg font-medium text-(--color-text-strong) mb-2 flex items-center gap-2">
          <Icon icon={PiUserCheck} size={20} />
          Membership
        </h3>

        {/* Estado + activar/desactivar */}
        <div className="flex items-center justify-between gap-4 py-2">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  user?.active
                    ? 'bg-(--color-success-soft) text-(--color-success-strong)'
                    : 'bg-(--color-surface-hover) text-(--color-text-subtle)'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${user?.active ? 'bg-(--color-success-solid)' : 'bg-(--color-text-subtle)'}`} />
                {user?.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-(--color-text-subtle)">
              Inactive members stay on the team but are skipped by auto-assignment.
            </p>
          </div>
          <Button
            variant="outlined"
            color={user?.active ? 'warning' : 'success'}
            size="sm"
            onClick={() => setActive(!user?.active)}
            disabled={loadingUser || settingActive}
            loading={settingActive}
          >
            {user?.active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>

        {/* Desincronizar del equipo */}
        <div className="mt-3 flex items-center justify-between gap-4 rounded-lg border border-(--color-error-border) bg-(--color-error-soft) px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-(--color-text-strong)">Remove from team</p>
            <p className="mt-0.5 text-sm text-(--color-text-subtle)">
              Desyncs from this workspace (roles & vacations included). Re-sync from ClickUp anytime.
            </p>
          </div>
          <Button
            variant="soft"
            color="error"
            size="sm"
            startIcon={<Icon icon={PiTrash} size={16} />}
            onClick={() => setConfirmingRemove(true)}
            disabled={loadingUser || removing}
            loading={removing}
          >
            Remove
          </Button>
        </div>
      </div>

      <DeleteConfirmDialog
        open={confirmingRemove}
        onClose={() => setConfirmingRemove(false)}
        onConfirm={() => {
          setConfirmingRemove(false)
          removeUser()
        }}
        itemName={user?.name}
        itemKind="member"
        title="Remove this member?"
        description={`${user?.name ?? 'This member'} and their roles & vacations will be removed from this workspace. You can re-sync them from ClickUp later.`}
        confirmLabel="Remove"
      />
    </div>
  )
}
