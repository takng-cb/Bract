/**
 * featureFlag.ts の単体テスト。
 *
 * process.env.AI_FEATURE_ENABLED を切り替えて、各値での判定を検証する。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isAIFeatureEnabled, ensureAIFeatureEnabled, AIFeatureDisabledError } from './featureFlag'

describe('isAIFeatureEnabled', () => {
  const ORIGINAL = process.env.AI_FEATURE_ENABLED

  beforeEach(() => {
    delete process.env.AI_FEATURE_ENABLED
  })
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.AI_FEATURE_ENABLED
    else process.env.AI_FEATURE_ENABLED = ORIGINAL
  })

  it('未設定なら false', () => {
    expect(isAIFeatureEnabled()).toBe(false)
  })

  it('空文字なら false', () => {
    process.env.AI_FEATURE_ENABLED = ''
    expect(isAIFeatureEnabled()).toBe(false)
  })

  it('"true" で true', () => {
    process.env.AI_FEATURE_ENABLED = 'true'
    expect(isAIFeatureEnabled()).toBe(true)
  })

  it('"TRUE" など大文字も true', () => {
    process.env.AI_FEATURE_ENABLED = 'TRUE'
    expect(isAIFeatureEnabled()).toBe(true)
  })

  it('"1" / "yes" / "on" / "enabled" も true', () => {
    for (const v of ['1', 'yes', 'on', 'enabled', 'YES', 'ON']) {
      process.env.AI_FEATURE_ENABLED = v
      expect(isAIFeatureEnabled(), `value: ${v}`).toBe(true)
    }
  })

  it('"false" / "0" / "no" / "off" など truthy 以外は false', () => {
    for (const v of ['false', '0', 'no', 'off', 'disabled', 'maybe', 'foo']) {
      process.env.AI_FEATURE_ENABLED = v
      expect(isAIFeatureEnabled(), `value: ${v}`).toBe(false)
    }
  })

  it('前後の空白はトリムされる', () => {
    process.env.AI_FEATURE_ENABLED = '  true  '
    expect(isAIFeatureEnabled()).toBe(true)
  })
})

describe('ensureAIFeatureEnabled', () => {
  const ORIGINAL = process.env.AI_FEATURE_ENABLED

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.AI_FEATURE_ENABLED
    else process.env.AI_FEATURE_ENABLED = ORIGINAL
  })

  it('有効なら何も throw しない', () => {
    process.env.AI_FEATURE_ENABLED = 'true'
    expect(() => ensureAIFeatureEnabled()).not.toThrow()
  })

  it('無効なら AIFeatureDisabledError を throw', () => {
    delete process.env.AI_FEATURE_ENABLED
    expect(() => ensureAIFeatureEnabled()).toThrow(AIFeatureDisabledError)
  })

  it('AIFeatureDisabledError の name と message が固有', () => {
    delete process.env.AI_FEATURE_ENABLED
    try {
      ensureAIFeatureEnabled()
      throw new Error('expected to throw')
    } catch (e) {
      expect(e).toBeInstanceOf(AIFeatureDisabledError)
      expect((e as Error).name).toBe('AIFeatureDisabledError')
      expect((e as Error).message).toContain('AI 機能')
    }
  })
})
