'use server'

/**
 * PLAUD Note のエクスポート markdown/テキストから活動記録の項目を生成する（#143 / REQ-0077）。
 *
 * サーバからの共有リンク取得は PLAUD の Cloudflare に本番サーバIPが弾かれ不安定なため廃止。
 * ユーザーが PLAUD でエクスポートした markdown をアップロード → パース → 活動項目へ。
 * 構造（タイトル/セクション要約/アクションアイテム）が明確なので AI 抽出は不要。
 * コンテナ別フラグ `plaud_import` で有効化された時だけ動く。
 */
import { db } from '@/lib/db'
import { tasks } from '@/lib/schema'
import { revalidatePath } from 'next/cache'
import { ensureFeature } from '@/lib/license'
import { requirePermission } from '@/lib/permissions'
import { parsePlaudMarkdown, PlaudParseError, type PlaudActionItem } from '@/lib/plaud/markdown'
import { getActivityTypes } from '@/lib/activityTypes'

const MAX_LEN = 300_000 // アップロード本文の上限（約300KB）

export type PlaudImportResult =
  | {
      ok: true
      fields: { type?: string; subject: string; body: string }
      /** アクションアイテム（確認画面で ToDo 化を選択させる） */
      actionItems: PlaudActionItem[]
      meta: { hasSummary: boolean }
    }
  | { ok: false; error: string }

export async function importActivityFromPlaud(markdown: string): Promise<PlaudImportResult> {
  try {
    await ensureFeature('plaud_import')
  } catch {
    return { ok: false, error: 'PLAUD 取り込みは有効化されていません。管理者にお問い合わせください。' }
  }

  const text = (markdown ?? '').slice(0, MAX_LEN)
  if (!text.trim()) return { ok: false, error: 'ファイルが空です。' }

  let parsed
  try {
    parsed = parsePlaudMarkdown(text)
  } catch (e) {
    return { ok: false, error: e instanceof PlaudParseError ? e.message : 'PLAUD ファイルの解析に失敗しました。' }
  }

  // 種別は「打合せ」を既定に（活動種別に meeting があれば）
  const types = await getActivityTypes()
  const type = types.find((t) => t.value === 'meeting')?.value

  return {
    ok: true,
    fields: {
      type,
      subject: parsed.title.slice(0, 120),
      body: parsed.body,
    },
    actionItems: parsed.actionItems,
    meta: { hasSummary: !!parsed.summary },
  }
}

/** 確認画面で選択されたアクションアイテムを ToDo として作成する。 */
export async function createTasksFromPlaud(
  items: { task: string; person?: string }[],
): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  try {
    await ensureFeature('plaud_import')
    await requirePermission('tasks', 'create')
  } catch {
    return { ok: false, error: 'ToDo を作成する権限がありません。' }
  }

  const rows = (items ?? [])
    .filter((i) => i.task?.trim())
    .map((i) => ({
      title: i.task.trim().slice(0, 200),
      description: i.person?.trim() ? `PLAUD取込 / 担当: ${i.person.trim()}` : 'PLAUD取込',
      priority: 'medium',
    }))

  if (rows.length === 0) return { ok: true, created: 0 }

  await db.insert(tasks).values(rows)
  revalidatePath('/tasks')
  return { ok: true, created: rows.length }
}
