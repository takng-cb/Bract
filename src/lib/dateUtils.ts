/**
 * 日付ユーティリティ
 *
 * `Date.prototype.toISOString().slice(0, 10)` を Date が **ローカルタイム**で
 * 構築されているケースに使うと、UTC 変換で日付が 1 日ずれる（特に JST=UTC+9 で
 * 月初を表す 0:00 ローカル → 前日 15:00 UTC）。
 *
 * ローカルタイムの Year/Month/Day 成分から `YYYY-MM-DD` を組み立てる。
 */
export function formatDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** ローカルの「今日」を YYYY-MM-DD で返す */
export function todayLocal(): string {
  return formatDateLocal(new Date())
}

/** 指定年月（1始まり）の初日 YYYY-MM-DD */
export function firstOfMonth(year: number, month: number): string {
  return formatDateLocal(new Date(year, month - 1, 1))
}

/** 指定年月（1始まり）の末日 YYYY-MM-DD */
export function lastOfMonth(year: number, month: number): string {
  return formatDateLocal(new Date(year, month, 0))
}
