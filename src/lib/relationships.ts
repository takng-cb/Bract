/**
 * relationships.ts
 *
 * オブジェクト種別 + ID → 表示名 / 詳細 URL を解決するユーティリティ。
 * サーバー側 (Server Component / Server Action) でのみ使用。
 *
 * 組み込みオブジェクト（accounts / contacts / opportunities）は専用テーブルを参照。
 * それ以外はカスタムオブジェクト（book_records + book_definitions）を参照。
 */

import { db } from '@/lib/db'
import { accounts, contacts, opportunities, book_definitions, book_records } from '@/lib/schema'
import { inArray, eq, and } from 'drizzle-orm'

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

    default: {
      // カスタムオブジェクト（properties など）→ book_records を参照
      const objRows = await db
        .select({ id: book_definitions.id })
        .from(book_definitions)
        .where(eq(book_definitions.api_name, objectType))
        .limit(1)

      if (objRows.length === 0) {
        // 未知のオブジェクト種別：ID をそのまま返す
        return ids.map((id) => ({ id, label: id, href: '#' }))
      }

      const objectId = objRows[0].id
      const rows = await db
        .select({ id: book_records.id, data: book_records.data })
        .from(book_records)
        .where(and(
          eq(book_records.object_id, objectId),
          inArray(book_records.id, ids),
        ))

      return rows.map((r) => ({
        id:    r.id,
        label: String(r.data.name ?? r.data.title ?? r.id),
        sub:   r.data.status ? String(r.data.status) : undefined,
        href:  `/books/${objectType}/${r.id}`,
      }))
    }
  }
}

/** オブジェクト種別の日本語ラベル（静的な組み込みオブジェクトのみ） */
export const OBJECT_TYPE_LABELS: Record<string, string> = {
  accounts:      '取引先',
  contacts:      '人物',
  opportunities: '商談',
}

/**
 * 選択可能なオブジェクト種別一覧を返す。
 * 組み込みオブジェクト + DB に登録されたカスタムオブジェクト（is_builtin=false）を含む。
 * サーバー側専用。
 */
export async function getSelectableObjectTypes(): Promise<{ value: string; label: string }[]> {
  const builtin = Object.entries(OBJECT_TYPE_LABELS).map(([value, label]) => ({ value, label }))

  const customObjs = await db
    .select({ api_name: book_definitions.api_name, label: book_definitions.label })
    .from(book_definitions)
    .where(eq(book_definitions.is_builtin, false))

  const custom = customObjs.map((o) => ({ value: o.api_name, label: o.label }))

  return [...builtin, ...custom]
}

/** 後方互換：静的な OBJECT_TYPES 配列（組み込みのみ） */
export const OBJECT_TYPES = Object.keys(OBJECT_TYPE_LABELS)
