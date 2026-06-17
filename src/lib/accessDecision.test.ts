/**
 * アクセス制御の純粋判定ロジックの単体テスト（REQ-0083/0084 / ADR-0029）。
 * permissions.ts / recordGrants.ts が本番でこれらを呼ぶため、ここが本番経路を覆う。
 */
import { describe, it, expect } from 'vitest'
import { normScope, pickScope, canAccessRecord, isGrantActive } from './accessDecision'

describe('normScope', () => {
  it("'own' のみ own、それ以外は all", () => {
    expect(normScope('own')).toBe('own')
    expect(normScope('all')).toBe('all')
    expect(normScope('team')).toBe('all')   // 未実装値は安全側（all）
    expect(normScope('')).toBe('all')
    expect(normScope(null)).toBe('all')
    expect(normScope(undefined)).toBe('all')
  })
})

describe('pickScope', () => {
  it('read は readScope、それ以外は writeScope', () => {
    expect(pickScope('own', 'all', 'read')).toBe('own')
    expect(pickScope('own', 'all', 'create')).toBe('all')
    expect(pickScope('all', 'own', 'update')).toBe('own')
    expect(pickScope('all', 'own', 'delete')).toBe('own')
  })
})

describe('canAccessRecord', () => {
  const base = { isAdmin: false, canOp: true, scope: 'all' as const, ownerId: 'u1', meId: 'u1' }

  it('admin は常に許可（ブック権限が無くても）', () => {
    expect(canAccessRecord({ ...base, isAdmin: true, canOp: false, scope: 'own', ownerId: 'x', meId: 'y' })).toBe(true)
  })
  it('ブック権限が無ければ拒否（層1）', () => {
    expect(canAccessRecord({ ...base, canOp: false })).toBe(false)
  })
  it("scope='all' は owner を問わず許可", () => {
    expect(canAccessRecord({ ...base, scope: 'all', ownerId: 'other', meId: 'me' })).toBe(true)
  })
  it("scope='own' は owner が自分のときのみ許可", () => {
    expect(canAccessRecord({ ...base, scope: 'own', ownerId: 'me', meId: 'me' })).toBe(true)
    expect(canAccessRecord({ ...base, scope: 'own', ownerId: 'other', meId: 'me' })).toBe(false)
  })
  it("scope='own' で owner が null（担当者なし）は拒否", () => {
    expect(canAccessRecord({ ...base, scope: 'own', ownerId: null, meId: 'me' })).toBe(false)
  })
  it("scope='own' で 自分のIDが取れない（未ログイン）は拒否", () => {
    expect(canAccessRecord({ ...base, scope: 'own', ownerId: 'me', meId: null })).toBe(false)
  })
})

describe('isGrantActive', () => {
  const NOW = 1_750_000_000_000 // 固定の現在時刻（ms）

  it('expires_at が無ければ無期限で有効', () => {
    expect(isGrantActive(null, NOW)).toBe(true)
    expect(isGrantActive(undefined, NOW)).toBe(true)
    expect(isGrantActive('', NOW)).toBe(true)
  })
  it('未来は有効・過去は無効', () => {
    expect(isGrantActive(NOW + 1000, NOW)).toBe(true)
    expect(isGrantActive(NOW - 1000, NOW)).toBe(false)
  })
  it('Date / ISO 文字列の両方を受ける', () => {
    expect(isGrantActive(new Date(NOW + 60_000), NOW)).toBe(true)
    expect(isGrantActive(new Date(NOW - 60_000), NOW)).toBe(false)
    expect(isGrantActive(new Date(NOW + 60_000).toISOString(), NOW)).toBe(true)
  })
  it('不正な日付は安全側で有効（誤って締め出さない）', () => {
    expect(isGrantActive('not-a-date', NOW)).toBe(true)
  })
})
