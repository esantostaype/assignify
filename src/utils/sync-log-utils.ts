import { db } from '@/db'
import { syncLog } from '@/db/schema'

export async function createSyncLog(
  entityType: string,
  entityIntId: number | null,
  entityStringId: string | null,
  action: string,
  status: string,
  errorMessage?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clickupResponse?: any
) {
  try {
    await db.insert(syncLog).values({
      entityType,
      entityIntId,
      entityStringId,
      action,
      status,
      errorMessage,
      clickupResponse: clickupResponse ? clickupResponse : undefined,
    })
  } catch (error) {
    console.error('Error creating sync log:', error);
  }
}
