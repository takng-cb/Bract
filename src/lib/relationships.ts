/**
 * relationships.ts
 *
 * オブジェクト種別 + ID → 表示名 / 詳細 URL を解決するユーティリティ。
 * サーバー側 (Server Component / Server Action) でのみ使用。
 */

import { db } from '@/lib/db'
import { accounts, contacts, opportunities, properties } from '@/lib/schema'
import { inArray } from 'drizzle-orm'

export type ResolvedRecord = {
  id: string
  label: string   // 表示名
  sub?: string    // サブラベル（任意）
  href: string    // 詳細ページ URL
}

/** オブジェクト種別と ID 一覧から表示情報を解決する */
export async function resolveRecords(
  objectType: string,
  ids: string[],
): Promise<ResolvedRecord[]> {
  if (ids.length === 0) return []

  switch (objectType) {
    case 'accounts': {
      const rows = await db.select({ id: accounts.id, name: accounts.name })
        .from(accounts)
        .where(inArray(accounts.id, ids))
      return rows.map((r) => ({ id: r.id, label: r.name, href: `/accounts/${r.id}` }))
    }

    case 'contacts': {
      const rows = await db.select({ id: contacts.id, full_name: contacts.full_name })
        .from(contacts)
        .where(inArray(contacts.id, ids))
      return rows.map((r) => ({ id: r.id, label: r.full_name, href: `/contacts/${r.id}` }))
    }

    case 'opportunities': {
      const rows = await db.select({ id: opportunities.id, name: opportunities.name, stage: opportunities.stage })
        .from(opportunities)
        .where(inArray(opportunities.id, ids))
      return rows.map((r) => ({ id: r.id, label: r.name, sub: r.stage ?? undefined, href: `/opportunities/${r.id}` }))
    }

    case 'properties': {
      const rows = await db.select({ id: properties.id, name: properties.name, status: properties.status })
        .from(properties)
        .where(inArray(properties.id, ids))
      return rows.map((r) => ({ id: r.id, label: r.name, sub: r.status ?? undefined, href: `/properties/${r.id}` }))
    }

    default:
      return ids.map((id) => ({ id, label: id, href: '#' }))
  }
}

/** オブジェクト種別の日本語ラベル */
export const OBJECT_TYPE_LABELS: Record<string, string> = {
  accounts:      '取引先',
  contacts:      '担当者',
  opportunities: '商談',
  properties:    '物件・商品',
}

/** 選択可能なオブジェクト種別一覧 */
export const OBJECT_TYPES = Object.keys(OBJECT_TYPE_LABELS)
