/**
 * 日時の整形（REQ-0081）。サーバ/クライアント両方から使える純粋モジュール。
 *
 * 背景: 日時は timestamptz（UTC）保存。サーバコンポーネントで素の toLocaleString を
 * 使うと Vercel の Node が UTC のため GMT 表示になる。表示タイムゾーンを明示指定して整形する。
 *
 * - サーバ: `getAppTimeZone()`（@/lib/systemSettings）で設定値を取得して渡す。
 * - クライアント: `useAppTimeZone()`（@/components/TimeZoneProvider）から取得して渡す。
 */
export const DEFAULT_TIMEZONE = 'Asia/Tokyo'

/** IANA タイムゾーン名として妥当か（Intl で検証） */
export function isValidTimeZone(tz: string | null | undefined): boolean {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const LOCALE = 'ja-JP'

/** 日付＋時刻（例: 2026/06/17 15:30） */
export function fmtDateTime(value: Date | string | number | null | undefined, tz = DEFAULT_TIMEZONE): string {
  const d = toDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(d)
}

/** 日付のみ（例: 2026/06/17） */
export function fmtDate(value: Date | string | number | null | undefined, tz = DEFAULT_TIMEZONE): string {
  const d = toDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

/** 時刻のみ（例: 15:30） */
export function fmtTime(value: Date | string | number | null | undefined, tz = DEFAULT_TIMEZONE): string {
  const d = toDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat(LOCALE, { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d)
}

/** 指定タイムゾーンでの YYYY-MM-DD（「今日/昨日」判定や日付グループ化に使う） */
export function ymdInTz(value: Date | string | number, tz = DEFAULT_TIMEZONE): string {
  const d = toDate(value)
  if (!d) return ''
  // en-CA は YYYY-MM-DD 形式
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/**
 * アクティビティストリーム用の日付ラベル（指定タイムゾーン基準）。
 * 今日 → 「今日」、昨日 → 「昨日」、それ以外 → 「M月D日」。
 * @param nowMs 「今日」判定の基準時刻（呼び出し側で Date.now() を渡す。purity ルール回避のため引数化）
 */
export function dayLabelInTz(value: Date | string | number, nowMs: number, tz = DEFAULT_TIMEZONE): string {
  const d = toDate(value)
  if (!d) return '—'
  const ymd = ymdInTz(d, tz)
  if (ymd === ymdInTz(nowMs, tz)) return '今日'
  if (ymd === ymdInTz(nowMs - 86400000, tz)) return '昨日'
  return new Intl.DateTimeFormat(LOCALE, { timeZone: tz, month: 'long', day: 'numeric' }).format(d)
}
