'use server'

/**
 * 整備レコードの外部リンク（Google Drive 等）管理。
 * maintenance_records.drive_links（jsonb 配列 [{label,url}]）に追加/削除する。
 */
import { db } from '@/lib/db'
import { maintenance_records } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { requireEditor } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { DriveLink } from '@/industries/auto-body/lib/driveEmbed'

async function getLinks(id: string): Promise<DriveLink[]> {
  const [r] = await db.select({ drive_links: maintenance_records.drive_links })
    .from(maintenance_records).where(eq(maintenance_records.id, id))
  const v = r?.drive_links
  return Array.isArray(v) ? (v as DriveLink[]) : []
}

export async function addMaintenanceDriveLink(maintenanceId: string, label: string, url: string) {
  await requireEditor()
  const u = url.trim()
  if (!u) throw new Error('URL を入力してください')
  if (!/^https?:\/\//.test(u)) throw new Error('http(s) の URL を入力してください')
  const links = await getLinks(maintenanceId)
  links.push({ label: label.trim() || undefined, url: u })
  await db.update(maintenance_records)
    .set({ drive_links: links, updated_at: new Date() })
    .where(eq(maintenance_records.id, maintenanceId))
  revalidatePath(`/maintenance/${maintenanceId}`)
}

export async function removeMaintenanceDriveLink(maintenanceId: string, index: number) {
  await requireEditor()
  const links = await getLinks(maintenanceId)
  if (index >= 0 && index < links.length) {
    links.splice(index, 1)
    await db.update(maintenance_records)
      .set({ drive_links: links, updated_at: new Date() })
      .where(eq(maintenance_records.id, maintenanceId))
    revalidatePath(`/maintenance/${maintenanceId}`)
  }
}
