import { NextResponse } from 'next/server'
import { prisma } from '@/utils/prisma'

export async function GET() {
  try {
    const types = await prisma.taskType.findMany({
      include: {
        categories: {
          include: {
            tierList: true
          }
        }
      }
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

    // Crear el nuevo task type
    const newTaskType = await prisma.taskType.create({
      data: {
        name: name.trim()
      },
      include: {
        categories: {
          include: {
            tierList: true
          }
        }
      }
    })

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

    // Verificar que el task type existe
    const existingTaskType = await prisma.taskType.findUnique({
      where: { id: Number(id) }
    })

    if (!existingTaskType) {
      return NextResponse.json(
        { error: 'Task type not found' },
        { status: 404 }
      )
    }

    // Actualizar el task type
    const updatedTaskType = await prisma.taskType.update({
      where: { id: Number(id) },
      data: {
        name: name.trim()
      },
      include: {
        categories: {
          include: {
            tierList: true
          }
        }
      }
    })

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

    // Verificar que el task type existe
    const existingTaskType = await prisma.taskType.findUnique({
      where: { id: Number(id) },
      include: {
        categories: true
      }
    })

    if (!existingTaskType) {
      return NextResponse.json(
        { error: 'Task type not found' },
        { status: 404 }
      )
    }

    // Verificar si tiene categorías asociadas
    if (existingTaskType.categories.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete task type with associated categories' },
        { status: 400 }
      )
    }

    // Eliminar el task type
    await prisma.taskType.delete({
      where: { id: Number(id) }
    })

    return NextResponse.json({ message: 'Task type deleted successfully' })
  } catch (error) {
    console.error('Error deleting task type:', error)
    return NextResponse.json(
      { error: 'Failed to delete task type' },
      { status: 500 }
    )
  }
}