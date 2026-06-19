/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/sync/clickup-lists/route.ts  [SaaS fase 4]
// Descubre las LISTAS de ClickUp del workspace del usuario (crawl space→folder→list
// con SU token) y permite guardarlas como "listas asignables" (tabla brand) del
// workspace. Reemplaza el alta manual de brands: cada inquilino elige sus listas.
import { NextResponse } from 'next/server'
import axios from 'axios'
import { db } from '@/db'
import { brand } from '@/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { API_CONFIG } from '@/config'
import { getCurrentClickUpContext } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

interface DiscoveredList {
  id: string
  name: string
  spaceId: string
  folderId: string | null
  spaceName: string
  folderName: string | null
}

async function discoverLists(token: string, teamId: string | null): Promise<DiscoveredList[]> {
  const base = API_CONFIG.CLICKUP_API_BASE
  const H = { headers: { Authorization: token, 'Content-Type': 'application/json' } }
  const get = async (p: string) => (await axios.get(`${base}${p}`, H)).data

  const teams: any[] = teamId ? [{ id: teamId }] : (await get('/team')).teams || []
  const out: DiscoveredList[] = []
  for (const team of teams) {
    let spaces: any[] = []
    try { spaces = (await get(`/team/${team.id}/space?archived=false`)).spaces || [] } catch { continue }
    for (const sp of spaces) {
      try {
        const direct: any[] = (await get(`/space/${sp.id}/list?archived=false`)).lists || []
        for (const l of direct) out.push({ id: String(l.id), name: l.name, spaceId: String(sp.id), folderId: null, spaceName: sp.name, folderName: null })
      } catch { /* sin listas directas */ }
      try {
        const folders: any[] = (await get(`/space/${sp.id}/folder?archived=false`)).folders || []
        for (const f of folders) for (const l of (f.lists || [])) out.push({ id: String(l.id), name: l.name, spaceId: String(sp.id), folderId: String(f.id), spaceName: sp.name, folderName: f.name })
      } catch { /* sin folders */ }
    }
  }
  return out
}

/** GET → listas descubiertas del workspace + cuáles ya son "asignables" (brand). */
export async function GET() {
  const { token, teamId } = await getCurrentClickUpContext()
  if (!token) return NextResponse.json({ error: 'No ClickUp token for this session' }, { status: 400 })

  try {
    const discovered = await discoverLists(token, teamId)
    // "Asignable" = brand guardado Y ACTIVO (los desactivados ya no cuentan).
    const existing = await db.query.brand.findMany({
      where: and(eq(brand.workspaceId, teamId ?? '__none__'), eq(brand.isActive, true)),
      columns: { id: true },
    })
    const assignableIds = new Set(existing.map((b) => b.id))
    return NextResponse.json({
      lists: discovered.map((l) => ({ ...l, isAssignable: assignableIds.has(l.id) })),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to discover ClickUp lists', details: error?.response?.data?.err || error?.message },
      { status: 500 }
    )
  }
}

/** POST { listIds } → guarda esas listas como brands (asignables) del workspace. */
export async function POST(req: Request) {
  const { token, teamId } = await getCurrentClickUpContext()
  if (!token) return NextResponse.json({ error: 'No ClickUp token for this session' }, { status: 400 })

  try {
    const { listIds }: { listIds: string[] } = await req.json()
    if (!Array.isArray(listIds)) {
      return NextResponse.json({ error: 'listIds must be an array' }, { status: 400 })
    }

    const discovered = await discoverLists(token, teamId)
    const byId = new Map(discovered.map((l) => [l.id, l]))
    const selected = new Set(listIds)

    const created: string[] = []
    const errors: string[] = []
    // 1) Activar (insert/upsert) las listas SELECCIONADAS.
    for (const id of listIds) {
      const l = byId.get(id)
      if (!l) { errors.push(`Lista ${id} no encontrada en el workspace`); continue }
      try {
        await db
          .insert(brand)
          .values({
            id: l.id,
            name: l.name,
            spaceId: l.spaceId,
            folderId: l.folderId,
            teamId: teamId,
            isActive: true,
            workspaceId: teamId,
          })
          .onConflictDoUpdate({
            target: brand.id,
            set: { name: l.name, isActive: true, workspaceId: teamId, updatedAt: new Date() },
          })
        created.push(l.id)
      } catch (e) {
        errors.push(`No se pudo guardar "${l.name}": ${e instanceof Error ? e.message : 'error'}`)
      }
    }

    // 2) Desactivar las que YA NO están seleccionadas (sincroniza la selección del modal).
    //    No se borran: preserva roles/tareas que las referencian; solo dejan de ser asignables.
    const activos = await db.query.brand.findMany({
      where: and(eq(brand.workspaceId, teamId ?? '__none__'), eq(brand.isActive, true)),
      columns: { id: true },
    })
    const toDeactivate = activos.map((b) => b.id).filter((id) => !selected.has(id))
    if (toDeactivate.length > 0) {
      await db
        .update(brand)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(brand.workspaceId, teamId ?? '__none__'), inArray(brand.id, toDeactivate)))
    }

    return NextResponse.json({
      created,
      deactivated: toDeactivate.length,
      errors: errors.length ? errors : undefined,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to save lists', details: error?.message },
      { status: 500 }
    )
  }
}
