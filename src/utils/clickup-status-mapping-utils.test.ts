import { describe, it, expect } from 'vitest'
import { mapClickUpStatusToLocal, isActiveTaskStatus } from './clickup-status-mapping-utils'

describe('mapClickUpStatusToLocal (multi-tenant: usa el type de ClickUp)', () => {
  it('excluye cualquier estado con type done/closed sin importar el nombre', () => {
    expect(mapClickUpStatusToLocal('Entregado', 'done')).toBeNull()
    expect(mapClickUpStatusToLocal('Archivado', 'closed')).toBeNull()
    // Nombre cualquiera de otro workspace, pero type=done → excluido.
    expect(mapClickUpStatusToLocal('Listo para facturar', 'done')).toBeNull()
  })

  it('detecta aprobación/revisión por palabra clave', () => {
    expect(mapClickUpStatusToLocal('On Approval', 'custom')).toBe('ON_APPROVAL')
    expect(mapClickUpStatusToLocal('In Review', 'custom')).toBe('ON_APPROVAL')
    expect(mapClickUpStatusToLocal('QA Testing', 'custom')).toBe('ON_APPROVAL')
  })

  it('On Approval con type closed/done NO se excluye (regresión Inszone)', () => {
    // Inszone configura "On Approval" como closed; debe seguir siendo ON_APPROVAL.
    expect(mapClickUpStatusToLocal('On Approval', 'closed')).toBe('ON_APPROVAL')
    expect(mapClickUpStatusToLocal('On Approval', 'done')).toBe('ON_APPROVAL')
  })

  it('detecta trabajo activo por palabra clave', () => {
    expect(mapClickUpStatusToLocal('In Progress', 'custom')).toBe('IN_PROGRESS')
    expect(mapClickUpStatusToLocal('Doing', 'custom')).toBe('IN_PROGRESS')
  })

  it('estados open van a TO_DO por defecto', () => {
    expect(mapClickUpStatusToLocal('To Do', 'open')).toBe('TO_DO')
    expect(mapClickUpStatusToLocal('Backlog', 'open')).toBe('TO_DO')
    // open sin keyword reconocible → TO_DO.
    expect(mapClickUpStatusToLocal('Nuevo pedido', 'open')).toBe('TO_DO')
  })

  it('estados custom sin keyword reconocible caen en IN_PROGRESS', () => {
    expect(mapClickUpStatusToLocal('Etapa intermedia', 'custom')).toBe('IN_PROGRESS')
  })

  it('sigue funcionando sin type (retrocompatibilidad por nombre)', () => {
    expect(mapClickUpStatusToLocal('Done')).toBeNull()
    expect(mapClickUpStatusToLocal('In Progress')).toBe('IN_PROGRESS')
    expect(mapClickUpStatusToLocal('To Do')).toBe('TO_DO')
  })

  it('isActiveTaskStatus excluye done/closed', () => {
    expect(isActiveTaskStatus('Cerrada', 'closed')).toBe(false)
    expect(isActiveTaskStatus('To Do', 'open')).toBe(true)
  })
})
