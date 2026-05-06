import { db } from './db'
import { import_logs } from './schema'

/**
 * インポート結果をDBに記録する。
 * ログ書き込み自体のエラーはサイレントに無視し、インポート処理を妨げない。
 */
export async function logImport(opts: {
  route:      string
  imported:   number
  updated?:   number
  userErrors: string[]  // ユーザー向けの分かりやすいエラーメッセージ
  rawErrors:  string[]  // 管理者向けの技術的エラー詳細
}): Promise<void> {
  try {
    await db.insert(import_logs).values({
      route:       opts.route,
      imported:    opts.imported,
      updated:     opts.updated ?? 0,
      user_errors: JSON.stringify(opts.userErrors),
      raw_errors:  JSON.stringify(opts.rawErrors),
    })
  } catch {
    // ログ記録の失敗はインポート結果に影響させない
  }
}

/**
 * DBエラーをユーザー向けの日本語メッセージに変換する。
 * 技術的な詳細（SQL文など）は含めない。
 */
export function toUserFriendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('invalid input syntax for type date')) {
    return '日付の形式が正しくありません（YYYY-MM-DD 形式で入力してください）'
  }
  if (msg.includes('invalid input syntax for type numeric') || msg.includes('invalid input syntax for type integer') || msg.includes('invalid input syntax for type bigint')) {
    return '数値の形式が正しくありません'
  }
  if (msg.includes('null value in column') && msg.includes('not-null')) {
    return '必須項目が空欄です'
  }
  if (msg.includes('value too long')) {
    return '入力値が長すぎます'
  }
  if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
    return '同じデータがすでに存在します'
  }
  if (msg.includes('foreign key constraint') || msg.includes('violates foreign key')) {
    return '関連データが見つかりません'
  }
  return '入力データのエラーが発生しました。データの内容を確認してください。'
}
