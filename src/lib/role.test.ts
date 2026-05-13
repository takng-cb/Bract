import { describe, it, expect } from 'vitest'
import { canEditRole, isAdminRole, type Role } from './role'

describe('canEditRole（編集可能ロール判定）', () => {
  it('admin → true', () => {
    expect(canEditRole('admin')).toBe(true)
  })

  it('editor → true', () => {
    expect(canEditRole('editor')).toBe(true)
  })

  it('viewer → false', () => {
    expect(canEditRole('viewer')).toBe(false)
  })

  it('null → false', () => {
    expect(canEditRole(null)).toBe(false)
  })

  it('undefined → false', () => {
    expect(canEditRole(undefined)).toBe(false)
  })

  it('全 Role 列挙: admin / editor のみが true', () => {
    const allRoles: Role[] = ['admin', 'editor', 'viewer']
    const expected = { admin: true, editor: true, viewer: false }
    for (const r of allRoles) {
      expect(canEditRole(r)).toBe(expected[r])
    }
  })

  it('未知の値 (as unknown) → false（型システム外の安全性）', () => {
    // 実運用で DB に想定外のロール文字列が紛れ込んだ場合の安全性確認
    expect(canEditRole('superuser' as unknown as Role)).toBe(false)
    expect(canEditRole('' as unknown as Role)).toBe(false)
  })
})

describe('isAdminRole（admin ロール判定）', () => {
  it('admin → true', () => {
    expect(isAdminRole('admin')).toBe(true)
  })

  it('editor → false（管理者ではない）', () => {
    expect(isAdminRole('editor')).toBe(false)
  })

  it('viewer → false', () => {
    expect(isAdminRole('viewer')).toBe(false)
  })

  it('null → false', () => {
    expect(isAdminRole(null)).toBe(false)
  })

  it('undefined → false', () => {
    expect(isAdminRole(undefined)).toBe(false)
  })

  it('未知の値 → false', () => {
    expect(isAdminRole('owner' as unknown as Role)).toBe(false)
  })
})

describe('canEditRole と isAdminRole の包含関係', () => {
  // admin であれば必ず canEdit でもある（権限の階層性）
  it('admin: isAdmin かつ canEdit', () => {
    expect(isAdminRole('admin')).toBe(true)
    expect(canEditRole('admin')).toBe(true)
  })

  it('editor: canEdit だが isAdmin ではない', () => {
    expect(isAdminRole('editor')).toBe(false)
    expect(canEditRole('editor')).toBe(true)
  })

  it('viewer: どちらでもない', () => {
    expect(isAdminRole('viewer')).toBe(false)
    expect(canEditRole('viewer')).toBe(false)
  })
})
