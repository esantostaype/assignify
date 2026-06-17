import { NextResponse } from 'next/server'
import { db } from '@/db'
import { taskType } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Lee/escribe datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    
    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Invalid task type ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name } = body

    // Validación básica
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Verificar que el task type existe
    const existingTaskType = await db.query.taskType.findFirst({
      where: eq(taskType.id, Number(id))
    })

    if (!existingTaskType) {
      return NextResponse.json(
        { error: 'Task type not found' },
        { status: 404 }
      )
    }

    // Actualizar el task type
    const [updatedTaskType] = await db
      .update(taskType)
      .set({ name: name.trim() })
      .where(eq(taskType.id, Number(id)))
      .returning()

    return NextResponse.json(updatedTaskType)
  } catch (error) {
    console.error('Error updating task type:', error)
    
    // Manejar error de duplicado
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A task type with this name already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update task type' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    
    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Invalid task type ID' },
        { status: 400 }
      )
    }

    // Verificar que el task type existe
    const existingTaskType = await db.query.taskType.findFirst({
      where: eq(taskType.id, Number(id))
    })

    if (!existingTaskType) {
      return NextResponse.json(
        { error: 'Task type not found' },
        { status: 404 }
      )
    }

    // Eliminar el task type
    await db.delete(taskType).where(eq(taskType.id, Number(id)))

    return NextResponse.json({ message: 'Task type deleted successfully' })
  } catch (error) {
    console.error('Error deleting task type:', error)
    return NextResponse.json(
      { error: 'Failed to delete task type' },
      { status: 500 }
    )
  }
}