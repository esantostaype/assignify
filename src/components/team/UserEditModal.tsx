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
import { UserVacationRow } from './UserVacationRow'
import { AddRoleForm } from './AddRoleForm'
import { AddVacationForm } from './AddVacationForm'
import { Icon, PiUser, PiCalendarBlank, PiMedal, PiUserCheck, PiTrash } from '@/lib/icons'
import { useUserDetails, useTaskTypes, useBrands, userKeys } from '@/hooks/queries/useUsers'
import { workloadKeys } from '@/hooks/queries/useWorkload'
import {
  Alert,
  Select,
  Button,
  Modal,
  DiscardChangesDialog,
  DeleteConfirmDialog,
  type SelectOption,
} from '@/components/ui'

type UserLevel = 'JUNIOR' | 'MID' | 'SENIOR'

interface PendingRole {
  tempId: number
  typeId: number
  brandId: string | null
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
  const { data: brands = [], isLoading: loadingBrands, error: brandsError } = useBrands()

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
      .map((r) => ({ ...r, isPrimary: primaryOverrides[r.id] ?? r.isPrimary })),
    ...rolesToAdd.map((p) => ({
      id: p.tempId,
      isPrimary: p.isPrimary,
      type: { name: taskTypes.find((t) => t.id === p.typeId)?.name ?? '—' },
      brand: p.brandId ? { name: brands.find((b) => b.id === p.brandId)?.name ?? '—' } : null,
    })),
  ]

  const visibleVacations = [
    ...(user?.vacations ?? []).filter((v) => !vacationIdsToRemove.includes(v.id)),
    ...vacationsToAdd.map((p) => ({ id: p.tempId, userId, startDate: p.startDate, endDate: p.endDate })),
  ]

  // ── Handlers de edición (solo estado local) ───────────────────────────────
  const addRole = (typeId: number, brandId?: string, isPrimary?: boolean) =>
    setRolesToAdd((prev) => [...prev, { tempId: tempId.current--, typeId, brandId: brandId || null, isPrimary: !!isPrimary }])

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
        await axios.post(`/api/users/${userId}/roles`, { typeId: r.typeId, brandId: r.brandId, isPrimary: r.isPrimary })
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

  const loadError = userError || typesError || brandsError

  return (
    <>
      <Modal
        open={open}
        onClose={attemptClose}
        staticBackdrop
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
                      <th className="p-2 text-left text-sm font-medium text-(--color-text-muted) first:pl-4 last:pr-4">Brand</th>
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
                        <td colSpan={4} className="px-3 py-4 text-center text-(--color-text-subtle)">
                          No roles assigned
                        </td>
                      </tr>
                    )}
                    {loadingUser && (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-(--color-text-subtle)">
                          Loading roles...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <AddRoleForm
                taskTypes={taskTypes}
                brands={brands}
                onAdd={(typeId, brandId, isPrimary) => addRole(typeId, brandId, isPrimary)}
                loading={false}
                loadingTypes={loadingTypes}
                loadingBrands={loadingBrands}
              />
            </div>

            <div className="border-t border-(--color-border-default)" />

            {/* Vacations */}
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-lg font-medium text-(--color-text-strong)">
                <Icon icon={PiCalendarBlank} size={20} />
                Vacations
              </h3>
              <div className="mb-4 overflow-hidden rounded-lg border border-(--color-border-default)">
                <table className="w-full">
                  <thead className="bg-(--color-surface-hover)">
                    <tr>
                      <th className="p-2 text-left text-sm font-medium text-(--color-text-muted) first:pl-4 last:pr-4">Start Date</th>
                      <th className="p-2 text-left text-sm font-medium text-(--color-text-muted) first:pl-4 last:pr-4">End Date</th>
                      <th className="p-2 text-left text-sm font-medium text-(--color-text-muted) first:pl-4 last:pr-4">Duration</th>
                      <th className="w-[5rem] p-2 text-left text-sm font-medium text-(--color-text-muted) first:pl-4 last:pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleVacations.map((vacation) => (
                      <UserVacationRow key={vacation.id} vacation={vacation} onDelete={deleteVacation} loading={loadingUser} />
                    ))}
                    {!loadingUser && visibleVacations.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-(--color-text-subtle)">
                          No vacations scheduled
                        </td>
                      </tr>
                    )}
                    {loadingUser && (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-(--color-text-subtle)">
                          Loading vacations...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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

              <div className="flex items-center justify-between gap-4 py-2">
                <div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      effectiveActive
                        ? 'bg-(--color-success-soft) text-(--color-success-strong)'
                        : 'bg-(--color-surface-hover) text-(--color-text-subtle)'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${effectiveActive ? 'bg-(--color-success-solid)' : 'bg-(--color-text-subtle)'}`} />
                    {effectiveActive ? 'Active' : 'Inactive'}
                  </span>
                  <p className="mt-1.5 text-sm text-(--color-text-subtle)">
                    Inactive members stay on the team but are skipped by auto-assignment.
                  </p>
                </div>
                <Button
                  variant="outlined"
                  color={effectiveActive ? 'warning' : 'success'}
                  size="sm"
                  onClick={() => setPendingActive(!effectiveActive)}
                  disabled={loadingUser}
                >
                  {effectiveActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-4 rounded-lg border border-(--color-error-border) bg-(--color-error-soft) px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-(--color-text-strong)">Remove from team</p>
                  <p className="mt-0.5 text-sm text-(--color-text-subtle)">
                    Desyncs from this workspace (roles &amp; vacations included). Re-sync from ClickUp anytime.
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
