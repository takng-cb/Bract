/**
 * datetime フォーマッタの単体テスト（REQ-0081）。
 * UTC 保存値を指定タイムゾーンで整形できること・不正値/不正TZの扱いを検証。
 */
import { describe, it, expect } from 'vitest'
import { fmtDate, fmtDateTime, fmtTime, ymdInTz, dayLabelInTz, isValidTimeZone, DEFAULT_TIMEZONE } from './datetime'

// 2026-06-16T20:00:00Z = Asia/Tokyo(+9) で 2026-06-17 05:00
const UTC = '2026-06-16T20:00:00Z'

describe('isValidTimeZone', () => {
  it('正当な IANA 名を受理', () => {
    expect(isValidTimeZone('Asia/Tokyo')).toBe(true)
    expect(isValidTimeZone('UTC')).toBe(true)
    expect(isValidTimeZone('America/New_York')).toBe(true)
  })
  it('不正値・空を拒否', () => {
    expect(isValidTimeZone('Bogus/Zone')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
    expect(isValidTimeZone(null)).toBe(false)
    expect(isValidTimeZone(undefined)).toBe(false)
  })
})

describe('fmt* (Asia/Tokyo)', () => {
  it('fmtDate は +9 の暦日', () => {
    expect(fmtDate(UTC, 'Asia/Tokyo')).toBe('2026/06/17')
  })
  it('fmtTime は +9 の時刻', () => {
    expect(fmtTime(UTC, 'Asia/Tokyo')).toBe('05:00')
  })
  it('fmtDateTime は日付＋時刻', () => {
    expect(fmtDateTime(UTC, 'Asia/Tokyo')).toBe('2026/06/17 05:00')
  })
  it('ymdInTz は YYYY-MM-DD', () => {
    expect(ymdInTz(UTC, 'Asia/Tokyo')).toBe('2026-06-17')
  })
})

describe('fmt* (UTC)', () => {
  it('UTC 指定はそのまま', () => {
    expect(fmtDate(UTC, 'UTC')).toBe('2026/06/16')
    expect(fmtTime(UTC, 'UTC')).toBe('20:00')
    expect(ymdInTz(UTC, 'UTC')).toBe('2026-06-16')
  })
})

describe('null/空の扱い', () => {
  it('null/空文字は —', () => {
    expect(fmtDate(null)).toBe('—')
    expect(fmtDateTime(undefined)).toBe('—')
    expect(fmtTime('')).toBe('—')
  })
})

describe('dayLabelInTz', () => {
  // now = 2026-06-17 05:00 JST（UTC の 2026-06-16T20:00Z）
  const NOW = new Date(UTC).getTime()
  it('当日は「今日」', () => {
    expect(dayLabelInTz('2026-06-17T01:00:00Z', NOW, 'Asia/Tokyo')).toBe('今日') // JST 10:00 同日
  })
  it('前日は「昨日」', () => {
    expect(dayLabelInTz('2026-06-16T01:00:00Z', NOW, 'Asia/Tokyo')).toBe('昨日') // JST 6/16 10:00
  })
  it('それ以前は M月D日', () => {
    expect(dayLabelInTz('2026-06-10T01:00:00Z', NOW, 'Asia/Tokyo')).toBe('6月10日')
  })
  it('タイムゾーンで判定が変わる', () => {
    // now=6/16 20:00Z（JST 6/17 / UTC 6/16）。値 6/16 10:00Z は…
    //   JST: 6/16 19:00 → JST の当日は 6/17 なので「昨日」
    //   UTC: 6/16 → UTC の当日 6/16 と同じなので「今日」
    expect(dayLabelInTz('2026-06-16T10:00:00Z', NOW, 'Asia/Tokyo')).toBe('昨日')
    expect(dayLabelInTz('2026-06-16T10:00:00Z', NOW, 'UTC')).toBe('今日')
  })
})

describe('既定タイムゾーン', () => {
  it('DEFAULT_TIMEZONE は Asia/Tokyo', () => {
    expect(DEFAULT_TIMEZONE).toBe('Asia/Tokyo')
    expect(fmtDate(UTC)).toBe('2026/06/17') // 既定で +9
  })
})
