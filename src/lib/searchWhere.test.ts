import { describe, it, expect } from 'vitest'
import { textColumns, textColumnsWhere } from './searchWhere'
import { accounts, contacts, expenses } from './schema'

describe('textColumns（グローバル検索のテキストカラム自動収集）', () => {
  it('accounts: name 以外も収集される（住所・電話など）', () => {
    const names = textColumns(accounts).map((c) => c.name)
    expect(names).toContain('name')
    expect(names).toContain('address')
    expect(names).toContain('phone')
    expect(names).toContain('description')
  })

  it('uuid / 数値 / 日付 / jsonb は対象外', () => {
    const names = textColumns(accounts).map((c) => c.name)
    expect(names).not.toContain('id')             // uuid
    expect(names).not.toContain('annual_revenue') // numeric
    expect(names).not.toContain('employee_count') // integer
    expect(names).not.toContain('created_at')     // timestamp
    expect(names).not.toContain('specialties')    // jsonb
  })

  it('contacts: メール・電話・備考も対象', () => {
    const names = textColumns(contacts).map((c) => c.name)
    expect(names).toContain('full_name')
    expect(names).toContain('email')
  })

  it('textColumnsWhere は OR ILIKE の SQL を返す', () => {
    expect(textColumnsWhere(expenses, '%交通%')).toBeDefined()
  })
})
