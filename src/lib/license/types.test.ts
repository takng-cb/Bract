/**
 * license/types.ts のエラー型テスト。
 * DB 接続不要な型ロジックのみ検証。
 */
import { describe, it, expect } from 'vitest'
import { FeatureNotLicensedError, LicenseInactiveError } from './types'

describe('FeatureNotLicensedError', () => {
  it('デフォルトメッセージに機能名が含まれる', () => {
    const err = new FeatureNotLicensedError('ai_summary')
    expect(err.name).toBe('FeatureNotLicensedError')
    expect(err.feature).toBe('ai_summary')
    expect(err.message).toContain('ai_summary')
  })

  it('カスタムメッセージを受け取れる', () => {
    const err = new FeatureNotLicensedError('line_integration', 'LINE 連携は別途お問い合わせください')
    expect(err.feature).toBe('line_integration')
    expect(err.message).toBe('LINE 連携は別途お問い合わせください')
  })

  it('Error のインスタンスとして throw / catch できる', () => {
    expect(() => {
      throw new FeatureNotLicensedError('ai_summary')
    }).toThrow()

    try {
      throw new FeatureNotLicensedError('ai_summary')
    } catch (e) {
      expect(e).toBeInstanceOf(FeatureNotLicensedError)
      expect(e).toBeInstanceOf(Error)
    }
  })
})

describe('LicenseInactiveError', () => {
  it('status を保持する', () => {
    const err = new LicenseInactiveError('expired')
    expect(err.name).toBe('LicenseInactiveError')
    expect(err.status).toBe('expired')
    expect(err.message).toContain('expired')
  })

  it('suspended 等の他の status でも動作', () => {
    const err = new LicenseInactiveError('suspended')
    expect(err.status).toBe('suspended')
  })
})
