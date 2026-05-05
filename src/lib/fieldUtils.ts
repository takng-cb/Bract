/**
 * フィールド関連のクライアント安全なユーティリティ
 * DB に依存しないため 'use client' コンポーネントから import 可能
 */

/** select フィールドの options JSON を文字列配列にパースする */
export function parseFieldOptions(options: string | null | undefined): string[] {
  if (!options) return []
  try { return JSON.parse(options) as string[] } catch { return [] }
}
