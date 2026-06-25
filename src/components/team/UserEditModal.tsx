'use client'
// Editor de miembro. Patrón Save/Discard (como /payroll/vp de la intranet): TODO
// lo que se toca —nivel, activo/inactivo, roles (añadir/quitar/primario) y
// vacaciones (añadir/quitar)— se acumula en estado LOCAL y se aplica de golpe con
// "Save Changes". Al cerrar con cambios sin guardar aparece "Discard Changes".
// "Remove from team" es destructivo y va aparte (su propia confirmación, no por Save).
import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { hotToast as toast } from '@/lib/hotToast'
import { useQueryClient } from '@tanstack/react-query'
import { UserRoleRow } from './UserRoleRow'
import { AddRoleForm } from './AddRoleForm'
import { AddVacationForm } from './AddVacationForm'
import { Icon, PiUser, PiCalendarBlank, PiMedal, PiUserCheck, PiTrash } from '@/lib/icons'
import { useUserDetails, useTaskTypes, userKeys } from '@/hooks/queries/useUsers'
import { workloadKeys } from '@/hooks/queries/useWorkload'
import {
  Alert,
  Select,
  Switch,
  Button,
  Modal,
  IconButton,
  DiscardChangesDialog,
  DeleteConfirmDialog,
  DataTable,
  type SelectOption,
  type DataTableColumn,
} from '@/components/ui'

type UserLevel = 'JUNIOR' | 'MID' | 'SENIOR'

interface VacationItem {
  id: number
  startDate: string
  endDate: string
}

interface PendingRole {
  tempId: number
  typeId: number
  isPrimary: boolean
}
interface PendingVacation {
  tempId: number
  startDate: string
  endDate: string
}

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
  open: boolean
  userId: string
  userName?: string
  onClose: () => void
}

export const UserEditModal: React.FC<UserEditModalProps> = ({ open, userId, userName, onClose }) => {
  const qc = useQueryClient()

  const { data: user, isLoading: loadingUser, error: userError } = useUserDetails(userId, open && !!userId)
  const { data: taskTypes = [], isLoading: loadingTypes, error: typesError } = useTaskTypes()

  // ── Cambios pendientes (no tocan el servidor hasta Save) ──────────────────
  const [pendingLevel, setPendingLevel] = useState<UserLevel | null>(null)
  const [pendingActive, setPendingActive] = useState<boolean | null>(null)
  const [rolesToAdd, setRolesToAdd] = useState<PendingRole[]>([])
  const [roleIdsToRemove, setRoleIdsToRemove] = useState<number[]>([])
  const [primaryOverrides, setPrimaryOverrides] = useState<Record<number, boolean>>({})
  const [vacationsToAdd, setVacationsToAdd] = useState<PendingVacation[]>([])
  const [vacationIdsToRemove, setVacationIdsToRemove] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const tempId = useRef(-1)

  const resetPending = () => {
    setPendingLevel(null)
    setPendingActive(null)
    setRolesToAdd([])
    setRoleIdsToRemove([])
    setPrimaryOverrides({})
    setVacationsToAdd([])
    setVacationIdsToRemove([])
  }

  // Al cambiar de miembro, descartar cualquier cambio pendiente.
  useEffect(() => {
    resetPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const hasChanges =
    pendingLevel !== null ||
    pendingActive !== null ||
    rolesToAdd.length > 0 ||
    roleIdsToRemove.length > 0 ||
    Object.keys(primaryOverrides).length > 0 ||
    vacationsToAdd.length > 0 ||
    vacationIdsToRemove.length > 0

  const effectiveLevel = (pendingLevel ?? (user?.level as UserLevel) ?? 'MID') as UserLevel
  const effectiveActive = pendingActive ?? user?.active ?? true

  // Vista combinada (servidor − quitados + pendientes) para roles y vacaciones.
  const visibleRoles = [
    ...(user?.roles ?? [])
      .filter((r) => !roleIdsToRemove.includes(r.id))
      .map((r) => ({ id: r.id, typeId: r.typeId, type: { name: r.type.name }, isPrimary: primaryOverrides[r.id] ?? r.isPrimary })),
    ...rolesToAdd.map((p) => ({
      id: p.tempId,
      typeId: p.typeId,
      type: { name: taskTypes.find((t) => t.id === p.typeId)?.name ?? '—' },
      isPrimary: p.isPrimary,
    })),
  ]

  const visibleVacations = [
    ...(user?.vacations ?? []).filter((v) => !vacationIdsToRemove.includes(v.id)),
    ...vacationsToAdd.map((p) => ({ id: p.tempId, userId, startDate: p.startDate, endDate: p.endDate })),
  ]

  // ── Handlers de edición (solo estado local) ───────────────────────────────
  const addRole = (typeId: number, isPrimary: boolean) =>
    setRolesToAdd((prev) => [...prev, { tempId: tempId.current--, typeId, isPrimary }])

  const deleteRole = (roleId: number) => {
    if (roleId < 0) {
      setRolesToAdd((prev) => prev.filter((r) => r.tempId !== roleId))
    } else {
      setRoleIdsToRemove((prev) => [...prev, roleId])
      setPrimaryOverrides((prev) => {
        const next = { ...prev }
        delete next[roleId]
        return next
      })
    }
  }

  const togglePrimary = (roleId: number, isPrimary: boolean) => {
    if (roleId < 0) setRolesToAdd((prev) => prev.map((r) => (r.tempId === roleId ? { ...r, isPrimary } : r)))
    else setPrimaryOverrides((prev) => ({ ...prev, [roleId]: isPrimary }))
  }

  const addVacation = (startDate: string, endDate: string) =>
    setVacationsToAdd((prev) => [...prev, { tempId: tempId.current--, startDate, endDate }])

  const deleteVacation = (vacationId: number) => {
    if (vacationId < 0) setVacationsToAdd((prev) => prev.filter((v) => v.tempId !== vacationId))
    else setVacationIdsToRemove((prev) => [...prev, vacationId])
  }

  // Columnas del DataTable de vacaciones (borrado DIRECTO; se confirma al Save).
  const vacationColumns: DataTableColumn<VacationItem>[] = [
    {
      key: 'start',
      header: 'Start Date',
      accessor: (v) => new Date(v.startDate).getTime(),
      skeleton: 'text',
      cell: (v) => new Date(v.startDate).toLocaleDateString(),
    },
    {
      key: 'end',
      header: 'End Date',
      skeleton: 'text',
      cell: (v) => new Date(v.endDate).toLocaleDateString(),
    },
    {
      key: 'duration',
      header: 'Duration',
      skeleton: 'text',
      cell: (v) =>
        `${Math.ceil((new Date(v.endDate).getTime() - new Date(v.startDate).getTime()) / (1000 * 60 * 60 * 24))} days`,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 72,
      skeleton: 'actions',
      expandedBare: true,
      cell: (v) => (
        <div className="flex justify-end">
          <IconButton
            aria-label="Remove vacation"
            size="sm"
            color="error"
            variant="soft"
            onClick={() => deleteVacation(v.id)}
          >
            <Icon icon={PiTrash} size={16} />
          </IconButton>
        </div>
      ),
    },
  ]

  const invalidateAfterWrite = () => {
    qc.invalidateQueries({ queryKey: userKeys.details(userId) })
    qc.invalidateQueries({ queryKey: workloadKeys.all })
    qc.invalidateQueries({ queryKey: userKeys.clickup() })
    qc.invalidateQueries({ queryKey: ['task-suggestion'] })
    qc.invalidateQueries({ queryKey: ['compatible-users'] })
    qc.invalidateQueries({ queryKey: ['user-slots'] })
    qc.invalidateQueries({ queryKey: ['best-user-selection'] })
    qc.invalidateQueries({ queryKey: ['task-data'] })
  }

  // ── Save: aplica TODOS los cambios pendientes ─────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      // Nivel + activo en un único PATCH.
      const patch: { level?: UserLevel; active?: boolean } = {}
      if (pendingLevel !== null) patch.level = pendingLevel
      if (pendingActive !== null) patch.active = pendingActive
      if (Object.keys(patch).length) await axios.patch(`/api/users/${userId}`, patch)

      // Roles: primero quitar, luego primarios de los existentes, luego añadir.
      for (const id of roleIdsToRemove) await axios.delete(`/api/users/${userId}/roles/${id}`)
      for (const [roleId, isPrimary] of Object.entries(primaryOverrides)) {
        await axios.patch(`/api/users/${userId}/roles/${roleId}`, { isPrimary })
      }
      for (const r of rolesToAdd) {
        await axios.post(`/api/users/${userId}/roles`, { typeId: r.typeId, brandId: null, isPrimary: r.isPrimary })
      }

      // Vacaciones: quitar y añadir.
      for (const id of vacationIdsToRemove) await axios.delete(`/api/users/${userId}/vacations/${id}`)
      for (const v of vacationsToAdd) {
        await axios.post(`/api/users/${userId}/vacations`, { startDate: v.startDate, endDate: v.endDate })
      }

      invalidateAfterWrite()
      toast.success({ title: 'Changes saved', description: 'Member updated.' })
      resetPending()
      onClose()
    } catch (error) {
      toast.error({
        title: "Couldn't save changes",
        description: serverErrorMessage(error, 'Some changes were not saved.'),
      })
    } finally {
      setSaving(false)
    }
  }

  const attemptClose = () => {
    if (saving) return
    if (hasChanges) {
      setConfirmingDiscard(true)
      return
    }
    onClose()
  }

  const confirmDiscard = () => {
    setConfirmingDiscard(false)
    resetPending()
    onClose()
  }

  const handleRemove = async () => {
    setRemoving(true)
    try {
      await axios.delete(`/api/users/${userId}`)
      qc.removeQueries({ queryKey: userKeys.details(userId) })
      qc.invalidateQueries({ queryKey: workloadKeys.all })
      qc.invalidateQueries({ queryKey: userKeys.clickup() })
      invalidateAfterWrite()
      toast.success({ title: 'Member removed', description: 'Desynced from this workspace.' })
      resetPending()
      onClose()
    } catch {
      toast.error({ title: "Couldn't remove member", description: 'They are still on the team.' })
    } finally {
      setRemoving(false)
      setConfirmingRemove(false)
    }
  }

  const loadError = userError || typesError

  return (
    <>
      <Modal
        open={open}
        onClose={attemptClose}
        title={`Edit Member${userName ? `: ${userName}` : ''}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" color="neutral" onClick={attemptClose} disabled={saving}>
              Cancel
            </Button>
            <Button color="primary" onClick={handleSave} disabled={!hasChanges || saving || loadingUser} loading={saving}>
              Save Changes
            </Button>
          </>
        }
      >
        {loadError ? (
          <Alert tone="error" variant="soft">
            <div>
              <strong>Error loading data.</strong> Please close and try again.
            </div>
          </Alert>
        ) : (
          <div className="space-y-6">
            {/* Level */}
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-lg font-medium text-(--color-text-strong)">
                <Icon icon={PiMedal} size={20} />
                Level
              </h3>
              <div className="max-w-[16rem]">
                <Select<UserLevel>
                  options={LEVEL_OPTIONS}
                  value={effectiveLevel}
                  onChange={(value) => setPendingLevel(value)}
                  disabled={loadingUser}
                  placeholder={loadingUser ? 'Loading...' : 'Select level'}
                  size="sm"
                />
              </div>
              <p className="mt-1.5 text-sm text-(--color-text-subtle)">
                Drives auto-assignment escalation (Jr → Mid → Sr).
              </p>
            </div>

            <div className="border-t border-(--color-border-default)" />

            {/* Roles */}
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-lg font-medium text-(--color-text-strong)">
                <Icon icon={PiUser} size={20} />
                User Roles
              </h3>
              <div className="mb-4 overflow-hidden rounded-lg border border-(--color-border-default)">
                <table className="w-full">
                  <thead className="bg-(--color-surface-hover)">
                    <tr>
                      <th className="p-2 text-left text-sm font-medium text-(--color-text-muted) first:pl-4 last:pr-4">Type</th>
                      <th className="p-2 text-left text-sm font-medium text-(--color-text-muted) first:pl-4 last:pr-4">Primary</th>
                      <th className="w-[5rem] p-2 text-left text-sm font-medium text-(--color-text-muted) first:pl-4 last:pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRoles.map((role) => (
                      <UserRoleRow
                        key={role.id}
                        role={role}
                        onDelete={deleteRole}
                        onTogglePrimary={togglePrimary}
                        loading={loadingUser}
                      />
                    ))}
                    {!loadingUser && visibleRoles.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-(--color-text-subtle)">
                          No roles assigned
                        </td>
                      </tr>
                    )}
                    {loadingUser && (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-(--color-text-subtle)">
                          Loading roles...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <AddRoleForm
                taskTypes={taskTypes}
                assignedTypeIds={visibleRoles.map((r) => r.typeId)}
                onAdd={addRole}
                loading={false}
                loadingTypes={loadingTypes}
              />
            </div>

            <div className="border-t border-(--color-border-default)" />

            {/* Vacations */}
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-lg font-medium text-(--color-text-strong)">
                <Icon icon={PiCalendarBlank} size={20} />
                Vacations
              </h3>
              <div className="mb-4">
                <DataTable<VacationItem>
                  data={visibleVacations}
                  columns={vacationColumns}
                  rowKey={(v) => v.id}
                  loading={loadingUser}
                  showSearch={false}
                  hidePageSizePicker
                  skeletonRowCount={1}
                  emptyState="No vacations scheduled"
                />
              </div>

              <AddVacationForm onAdd={addVacation} loading={false} existingVacations={visibleVacations} userId={userId} />
            </div>

            <div className="border-t border-(--color-border-default)" />

            {/* Membership */}
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-lg font-medium text-(--color-text-strong)">
                <Icon icon={PiUserCheck} size={20} />
                Membership
              </h3>

              {/* Activo / inactivo con switch */}
              <div className="flex items-center justify-between gap-4 rounded-lg border border-(--color-border-default) px-3.5 py-3">
                <div>
                  <p className="font-medium text-(--color-text-strong)">
                    {effectiveActive ? 'Active' : 'Inactive'}
                  </p>
                  <p className="mt-0.5 text-sm text-(--color-text-subtle)">
                    Inactive members stay on the team but are skipped by auto-assignment.
                  </p>
                </div>
                <Switch
                  aria-label={effectiveActive ? 'Deactivate member' : 'Activate member'}
                  checked={effectiveActive}
                  // Si el switch vuelve al valor del servidor, deja de contar como cambio.
                  onChange={(e) => setPendingActive(e.target.checked === user?.active ? null : e.target.checked)}
                  disabled={loadingUser}
                />
              </div>

              {/* Quitar del equipo (destructivo) como alerta */}
              <Alert tone="error" variant="soft" align="center" className="mt-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">Remove from team</p>
                    <p className="mt-0.5">
                      Desyncs from this workspace (roles &amp; vacations included). Re-sync from ClickUp anytime.
                    </p>
                  </div>
                  <Button
                    variant="soft"
                    color="error"
                    size="sm"
                    className="shrink-0"
                    startIcon={<Icon icon={PiTrash} size={16} />}
                    onClick={() => setConfirmingRemove(true)}
                    disabled={loadingUser || removing}
                    loading={removing}
                  >
                    Remove
                  </Button>
                </div>
              </Alert>
            </div>
          </div>
        )}
      </Modal>

      <DiscardChangesDialog
        open={confirmingDiscard}
        onClose={() => setConfirmingDiscard(false)}
        onConfirm={confirmDiscard}
      />

      <DeleteConfirmDialog
        open={confirmingRemove}
        onClose={() => setConfirmingRemove(false)}
        onConfirm={handleRemove}
        itemName={userName ?? user?.name}
        itemKind="member"
        title="Remove this member?"
        description={`${userName ?? user?.name ?? 'This member'} and their roles & vacations will be removed from this workspace. You can re-sync them from ClickUp later.`}
        confirmLabel="Remove"
      />
    </>
  )
}
