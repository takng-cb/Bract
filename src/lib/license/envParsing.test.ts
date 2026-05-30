/**
 * envParsing.ts の単体テスト。
 *
 * env 変数の真偽値解析が「truthy / falsy / 未設定」の 3 値を正しく返すか検証。
 */
import { describe, it, expect } from 'vitest'
import { parseEnvBool } from './envParsing'

describe('parseEnvBool', () => {
  it('undefined → null (未設定)', () => {
    expect(parseEnvBool(undefined)).toBe(null)
  })

  it('空文字 → false (設定済み・偽値)', () => {
    expect(parseEnvBool('')).toBe(false)
  })

  it('truthy 値 → true', () => {
    for (const v of ['true', '1', 'on', 'yes', 'enabled']) {
      expect(parseEnvBool(v), `value: ${v}`).toBe(true)
    }
  })

  it('大文字 truthy 値も true', () => {
    for (const v of ['TRUE', 'True', 'YES', 'On', 'ENABLED']) {
      expect(parseEnvBool(v), `value: ${v}`).toBe(true)
    }
  })

  it('falsy 値 → false', () => {
    for (const v of ['false', '0', 'no', 'off', 'disabled', 'maybe', 'foo']) {
      expect(parseEnvBool(v), `value: ${v}`).toBe(false)
    }
  })

  it('前後の空白はトリムされる', () => {
    expect(parseEnvBool('  true  ')).toBe(true)
    expect(parseEnvBool('\t1\n')).toBe(true)
  })

  it('null vs false の区別 (override semantics)', () => {
    // null: 未設定 → 他のロジック (DB 等) にフォールバック
    // false: 明示的に無効化 (kill switch)
    expect(parseEnvBool(undefined)).toBe(null)
    expect(parseEnvBool('false')).toBe(false)
  })
})
