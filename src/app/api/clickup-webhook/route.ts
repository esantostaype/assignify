/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/clickup-webhook/route.ts
// Recibe eventos de ClickUp y notifica a los clientes en tiempo real (Pusher).
// La DB ya no se sincroniza: el tablero y el motor leen las tareas en vivo de ClickUp.
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { publishTaskUpdate } from '@/lib/pusher'

// Recibe webhooks y usa request.url (challenge): nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic'

const WEBHOOK_SECRET = process.env.CLICKUP_WEBHOOK_SECRET
// Rechaza webhooks con firma inválida. Déjalo en 'false' hasta confirmar en logs
// que la firma coincide; luego pon CLICKUP_VERIFY_SIGNATURE=true en producción.
const VERIFY_SIGNATURE = process.env.CLICKUP_VERIFY_SIGNATURE === 'true'

// Eventos de ClickUp que crean/actualizan una tarea.
const MUTATING_EVENTS = [
  'taskCreated',
  'taskUpdated',
  'taskStatusUpdated',
  'taskAssigneeUpdated',
  'taskPriorityUpdated',
  'taskDueDateUpdated',
  'taskMoved',
]

const dlog = (...args: any[]) => {
  if (process.env.DEBUG_WEBHOOK === 'true') console.log(...args)
}

// GET: responde al challenge de verificación de ClickUp y sirve de health check.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('challenge')
  if (challenge) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    webhook_secret_configured: !!WEBHOOK_SECRET,
    verify_signature: VERIFY_SIGNATURE,
  })
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    if (!rawBody.trim()) {
      return NextResponse.json({ success: true, message: 'empty body (test ping)' })
    }

    // Verificación de firma HMAC de ClickUp sobre el cuerpo crudo.
    const signature = req.headers.get('x-signature') || ''
    if (WEBHOOK_SECRET) {
      const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')
      const matches =
        signature.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      if (!matches) {
        console.error(`Invalid webhook signature (verify=${VERIFY_SIGNATURE})`)
        if (VERIFY_SIGNATURE) {
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }
      } else {
        dlog('🔐 Firma de webhook verificada')
      }
    }

    const body = JSON.parse(rawBody)
    const event: string | undefined = body.event
    const taskId: string | undefined = body.task_id
    dlog(`🎯 Evento ${event} para tarea ${taskId}`)

    if (!event || !taskId) {
      return NextResponse.json({ success: true, message: 'sin event/task_id (probable test de ClickUp)' })
    }

    // Notificar a los clientes en tiempo real (Pusher). La DB ya no se toca:
    // el tablero y el motor de asignación leen las tareas en vivo de ClickUp.
    if (event === 'taskDeleted' || MUTATING_EVENTS.includes(event)) {
      // El cambio de estado viene en history_items (before/after); lo pasamos para
      // que la notificación diga "To Do → In Progress" en vez de solo "updated".
      const statusItem = Array.isArray(body.history_items)
        ? body.history_items.find((h: any) => h?.field === 'status')
        : null
      await publishTaskUpdate({
        taskId,
        name: body.task?.name,
        status: body.task?.status?.status,
        event,
        fromStatus: statusItem?.before?.status,
        toStatus: statusItem?.after?.status,
      })
    }

    return NextResponse.json({ success: true, event })
  } catch (error) {
    console.error('Error processing webhook:', error)
    // Responder 200 para que ClickUp no reintente en bucle.
    return NextResponse.json(
      { error: 'processing error', details: error instanceof Error ? error.message : 'unknown' },
      { status: 200 }
    )
  }
}
