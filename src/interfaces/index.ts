import { Priority, Status, Tier, Level } from '@/db/enums'

export interface TaskType {
  id: number
  name: string
}

export interface TierList {
  id: number
  name: Tier
  duration: number
}

export interface Brand {
  id: string
  name: string
  isActive: boolean
  clickupListId?: string
  defaultStatus: Status
  statusMapping: Record<string, string> | null
}

export interface User {
  id: string
  name: string
  email: string
  active: boolean
  level: Level
  roles: UserRole[]
}

export interface UserRole {
  id: number
  userId: string
  typeId: number
  brandId?: string | null
}

export interface UserVacation {
  id: number
  userId: string
  startDate: Date
  endDate: Date
}

export interface VacationAwareUserSlot extends UserSlot {
  upcomingVacations: UserVacation[]
  potentialTaskStart: Date
  potentialTaskEnd: Date
  hasVacationConflict: boolean
  workingDaysUntilAvailable: number
  vacationConflictDetails?: {
    conflictingVacation: UserVacation
    daysSavedByWaiting: number
  }
  /**
   * Afinidad de CARGO respecto al tipo de tarea pedido (escalado primario/secundario):
   * 1 = cargo PRIMARIO para el tipo, 2 = SECUNDARIO, 3 = otro cargo (fallback).
   * Opcional para retrocompatibilidad con consumidores existentes.
   */
  roleAffinity?: 1 | 2 | 3
  /**
   * Nº de tareas pendientes del diseñador con prioridad IGUAL o MAYOR a la pedida.
   * Se conserva solo para el texto explicativo (`reason`) del selector.
   */
  samePriorityOrHigherLoad?: number
  /**
   * Congestión del carril medida en DÍAS de trabajo (suma de duraciones de las
   * tareas de prioridad ≥ la pedida), no en nº de tareas. Es la métrica que usa
   * el comparador: 3 tareas de 30 min no deben pesar más que una de 5 días.
   */
  samePriorityOrHigherLoadDays?: number
  /** Estado para la UI del selector. */
  status?: MemberStatus
}

/** Estado de un diseñador para los badges del selector de asignación. */
export type MemberStatus = 'available' | 'on_vacation' | 'overloaded'

/**
 * Candidato “aplanado” que el motor devuelve a la UI: misma fuente de verdad
 * que la sugerencia (un solo origen). Alimenta tanto el diseñador sugerido como
 * la lista de opciones (con su badge) del selector.
 */
export interface RankedCandidate {
  userId: string
  userName: string
  status: MemberStatus
  /** Fecha (YYYY-MM-DD) desde la que el diseñador podría empezar la tarea. */
  availableFrom: string
  /** true para el diseñador que el motor sugiere. */
  isSuggested: boolean
  /** 1 primario / 2 secundario / 3 otro cargo, respecto al tipo pedido. */
  roleAffinity: 1 | 2 | 3
  /** Explicación legible de por qué el motor lo posiciona así (para la UI). */
  reason: string
}

export interface AssignmentCandidate {
  user: VacationAwareUserSlot
  type: 'specialist_eligible' | 'specialist_on_vacation' | 'generalist'
  priority: number
  workingDaysUntilStart: number
  reason: string
}

export interface Task {
  createdAt: string | number | Date
  id: string
  name: string
  description?: string
  typeId: number
  tierId: number
  brandId: string
  priority: Priority
  status: Status
  startDate: Date
  deadline: Date
  customDuration: number
  url?: string
  lastSyncAt?: Date
  syncStatus: string
  tier: TierList
  type: TaskType
  brand: Brand
  assignees: TaskAssignment[]
}

export interface TaskAssignment {
  id: number
  userId: string
  taskId: string
  user: User
}

export interface TierInfo {
  id: number
  name: string
  duration: number
  categoryCount: number
  categories: Array<{
    id: number
    name: string
    typeName: string
  }>
}

export interface UserSlot {
  userId: string
  userName: string
  availableDate: Date
  tasks: Task[]
  cargaTotal: number
  isSpecialist: boolean
  lastTaskDeadline?: Date
  totalAssignedDurationDays: number
  /** Nivel del diseñador (Junior/Mid/Senior); usado por el escalado de asignación. */
  level: Level
}

export interface QueueCalculationResult {
  insertAt: number
  calculatedStartDate: Date
  affectedTasks: Task[]
}

export interface TaskCreationParams {
  name: string
  description?: string
  typeId: number
  tierId: number
  priority: Priority
  brandId: string
  assignedUserIds?: string[]
  durationDays: number
  /** Nivel solicitado (Jr/Mid/Sr); decide el escalado de asignación automática. */
  level?: string
  /** Diseñador que el motor sugirió (para medir aciertos/override). No decide nada. */
  suggestedUserId?: string | null
}

export interface TaskTimingResult {
  startDate: Date
  deadline: Date
  insertAt: number
}

// Interfaz específica para ClickUp que garantiza statusMapping como Record<string, string>
export interface ClickUpBrand {
  teamId: string
  id: string
  name: string
  isActive: boolean
  clickupListId?: string
  defaultStatus: Status
}

export interface ClickUpTaskCreationParams {
  name: string
  description?: string
  priority: Priority
  deadline: Date
  startDate: Date
  usersToAssign: string[]
  tier: TierList
  brand: ClickUpBrand
}

export interface ClickUpTaskResponse {
  clickupTaskId: string
  clickupTaskUrl: string
}

export interface TaskFilters {
  brandId?: string
  status?: Status
  priority?: Priority
}

export interface PaginationParams {
  page: number
  limit: number
  skip: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// Tipos para mapeo de ClickUp
export interface ClickUpStatusMapping {
  [localStatus: string]: string
}

export interface AssigneeDebugInfo {
  userId: string
  userName?: string
  clickupId?: string
  willBeAssigned: boolean
  reason: string
}

// Tipos de utilidad
export type TaskWithAssignees = Task & {
  assignees: (TaskAssignment & { user: User })[]
}

export type UserWithRoles = User & {
  roles: UserRole[]
}

export interface UpdatedTask {
  id: string
  name: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority?: 'low' | 'medium' | 'high'
  assignedTo?: string
  dueDate?: string
  createdAt: string
  updatedAt: string
}

export interface ServerToClientEvents {
  connect: () => void
  disconnect: () => void
  task_update: (updatedTask: UpdatedTask) => void
}

export interface ClientToServerEvents {
  join_room: (roomId: string) => void
  leave_room: (roomId: string) => void
  update_task: (taskId: string, updates: Partial<UpdatedTask>) => void
}

export interface ExtendedFormValues extends FormValues {
  newCategoryTier: Tier | null
  isNewCategory: boolean
  newCategoryName: string
}

// También necesitamos actualizar FormValues para que sea más flexible
export interface FormValues {
  name: string
  description: string
  tierId: string
  priority: string
  brandId: string
  assignedUserIds: string[]
  durationDays: string
  // Nivel solicitado para la tarea (Jr/Mid/Sr). No se persiste: solo decide el diseñador.
  level: string
}

// Nueva interfaz para el request de creación de categoría
export interface CreateCategoryRequest {
  name: string
  duration: number
  tier: Tier
  typeId: number
}

// Nueva interfaz para la respuesta de creación de categoría
export interface CreateCategoryResponse {
  id: number
  name: string
  duration: number
  tier: Tier
  typeId: number
  createdAt: string
  updatedAt: string
}

export interface SuggestedAssignment {
  userId: string
  durationDays: number
}

export interface TaskWhereInput {
  brandId?: string
  status?: Status
  priority?: Priority
}

// Enums específicos para la aplicación
export enum SyncStatus {
  SYNCED = 'SYNCED',
  PENDING = 'PENDING',
  ERROR = 'ERROR'
}

export enum SyncAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE'
}

export enum SyncLogStatus {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}