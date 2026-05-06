'use server'

import { saveListViewColumns } from '@/lib/listViewSettings'
import { requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function updateListViewColumns(objectType: string, columns: string[]): Promise<void> {
  await requireAdmin()
  await saveListViewColumns(objectType, columns)
  revalidatePath(`/${objectType}`)
}
