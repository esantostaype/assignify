import { NextResponse } from 'next/server'
import { db } from '@/db'
import { taskType } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getCurrentWorkspaceId } from '@/lib/workspace'

// Lee datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const wsId = await getCurrentWorkspaceId()
    const types = await db.query.taskType.findMany({
      where: eq(taskType.workspaceId, wsId ?? '__none__'),
    })

    return NextResponse.json(types)
  } catch (error) {
    console.error('Error fetching task types:', error)
    return NextResponse.json(
      { error: 'Failed to fetch task types' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name } = body

    // Validación básica
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Crear el nuevo task type EN el workspace activo.
    const wsId = await getCurrentWorkspaceId()
    const [newTaskType] = await db
      .insert(taskType)
      .values({ name: name.trim(), workspaceId: wsId })
      .returning()

    return NextResponse.json(newTaskType, { status: 201 })
  } catch (error) {
    console.error('Error creating task type:', error)
    
    // Manejar error de duplicado (si name es único)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A task type with this name already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create task type' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.pathname.split('/').pop()
    
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

    // Verificar que el task type existe EN el workspace activo.
    const wsId = await getCurrentWorkspaceId()
    const existingTaskType = await db.query.taskType.findFirst({
      where: and(eq(taskType.id, Number(id)), eq(taskType.workspaceId, wsId ?? '__none__'))
    })

    if (!existingTaskType) {
      return NextResponse.json(
        { error: 'Task type not found' },
        { status: 404 }
      )
    }

    // Actualizar el task type (acotado al workspace).
    const [updatedTaskType] = await db
      .update(taskType)
      .set({ name: name.trim() })
      .where(and(eq(taskType.id, Number(id)), eq(taskType.workspaceId, wsId ?? '__none__')))
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

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.pathname.split('/').pop()
    
    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Invalid task type ID' },
        { status: 400 }
      )
    }

    // Verificar que el task type existe EN el workspace activo.
    const wsId = await getCurrentWorkspaceId()
    const existingTaskType = await db.query.taskType.findFirst({
      where: and(eq(taskType.id, Number(id)), eq(taskType.workspaceId, wsId ?? '__none__'))
    })

    if (!existingTaskType) {
      return NextResponse.json(
        { error: 'Task type not found' },
        { status: 404 }
      )
    }

    // Eliminar el task type (acotado al workspace).
    await db.delete(taskType).where(and(eq(taskType.id, Number(id)), eq(taskType.workspaceId, wsId ?? '__none__')))

    return NextResponse.json({ message: 'Task type deleted successfully' })
  } catch (error) {
    console.error('Error deleting task type:', error)
    return NextResponse.json(
      { error: 'Failed to delete task type' },
      { status: 500 }
    )
  }
}