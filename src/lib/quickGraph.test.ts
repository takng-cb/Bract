import { describe, it, expect } from 'vitest'
import { buildGraphNodes, OPP_STAGES, type GraphBookSpec } from './quickGraph'

// 実 TYPED_SPECS（quickAi.ts）と同じフィールド形を模した最小スペック
const SPECS: Record<string, GraphBookSpec> = {
  accounts: { label: '取引先', fields: [
    { apiName: 'name', label: '取引先名', fieldType: 'text' },
    { apiName: 'phone', label: '電話', fieldType: 'text' },
    { apiName: 'description', label: '備考', fieldType: 'textarea' },
  ] },
  contacts: { label: '人物', fields: [
    { apiName: 'full_name', label: '氏名', fieldType: 'text' },
    { apiName: 'title', label: '役職', fieldType: 'text' },
    { apiName: 'department', label: '部署', fieldType: 'text' },
  ] },
  opportunities: { label: '商談', fields: [
    { apiName: 'name', label: '商談名', fieldType: 'text' },
    { apiName: 'amount', label: '金額', fieldType: 'number' },
    { apiName: 'probability', label: '確度', fieldType: 'number' },
    { apiName: 'stage', label: 'ステージ', fieldType: 'select', options: [...OPP_STAGES] },
    { apiName: 'description', label: '備考', fieldType: 'textarea' },
  ] },
  activities: { label: '活動履歴', fields: [
    { apiName: 'subject', label: '件名', fieldType: 'text' },
    { apiName: 'type', label: '種別', fieldType: 'select', options: ['call', 'email', 'meeting', 'note'] },
    { apiName: 'body', label: '内容', fieldType: 'textarea' },
  ] },
  tasks: { label: 'ToDo', fields: [
    { apiName: 'title', label: 'タイトル', fieldType: 'text' },
    { apiName: 'priority', label: '優先度', fieldType: 'select', options: ['high', 'medium', 'low'] },
  ] },
}
const ALLOWED = ['accounts', 'contacts', 'opportunities', 'activities', 'tasks']

describe('buildGraphNodes', () => {
  it('フルグラフ（取引先＋商談＋明細＋活動）を関係ごと組み立てる', () => {
    const records = [
      { ref: 'a1', book: 'accounts', fields: { name: '株式会社山田製作所' } },
      {
        ref: 'o1', book: 'opportunities', account_ref: 'a1',
        fields: { name: '産業用ポンプ提案', amount: '2000000', probability: '20', stage: 'proposal' },
        line_items: [{ name: '産業用ポンプAX-200', quantity: '1', unit_price: '2000000' }],
      },
      { ref: 'act1', book: 'activities', fields: { subject: '訪問', type: 'meeting' }, related_refs: ['a1', 'o1'] },
    ]
    const nodes = buildGraphNodes(records, ALLOWED, SPECS)
    expect(nodes.map((n) => n.book)).toEqual(['accounts', 'opportunities', 'activities'])

    const opp = nodes.find((n) => n.book === 'opportunities')!
    expect(opp.accountRef).toBe('a1')
    expect(opp.fields.find((f) => f.apiName === 'amount')?.value).toBe('2000000')
    expect(opp.fields.find((f) => f.apiName === 'probability')?.value).toBe('20')
    expect(opp.fields.find((f) => f.apiName === 'stage')?.value).toBe('proposal')
    expect(opp.lineItems).toEqual([{ name: '産業用ポンプAX-200', quantity: '1', unit_price: '2000000' }])

    const act = nodes.find((n) => n.book === 'activities')!
    expect(act.relatedRefs).toEqual(['a1', 'o1'])
    expect(act.lineItems).toBeUndefined()  // 商談以外は明細を持たない
  })

  it('許可されていない book のレコードは破棄する', () => {
    const records = [
      { ref: 'v1', book: 'vehicles', fields: { maker: 'トヨタ' } },
      { ref: 'a1', book: 'accounts', fields: { name: 'A社' } },
    ]
    const nodes = buildGraphNodes(records, ALLOWED, SPECS)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].book).toBe('accounts')
  })

  it('ref 未指定は採番し、重複 ref は一意化する', () => {
    const records = [
      { book: 'accounts', fields: { name: 'A社' } },                 // ref なし → n1
      { ref: 'dup', book: 'accounts', fields: { name: 'B社' } },
      { ref: 'dup', book: 'accounts', fields: { name: 'C社' } },     // 重複 → dup_
    ]
    const nodes = buildGraphNodes(records, ALLOWED, SPECS)
    const refs = nodes.map((n) => n.ref)
    expect(new Set(refs).size).toBe(3)            // すべて一意
    expect(refs[0]).toBe('n1')
    expect(refs).toContain('dup')
    expect(refs).toContain('dup_')
  })

  it('不正な stage 値は空にし、正規値は保持する', () => {
    const records = [
      { ref: 'o1', book: 'opportunities', fields: { name: 'X', stage: '検討中' } },   // 不正→空
      { ref: 'o2', book: 'opportunities', fields: { name: 'Y', stage: 'negotiation' } }, // 正規→保持
    ]
    const [o1, o2] = buildGraphNodes(records, ALLOWED, SPECS)
    expect(o1.fields.find((f) => f.apiName === 'stage')?.value).toBe('')
    expect(o2.fields.find((f) => f.apiName === 'stage')?.value).toBe('negotiation')
  })

  it('連絡先は account_ref を取り込み、空の明細名は除外、quantity 既定は 1', () => {
    const records = [
      { ref: 'c1', book: 'contacts', account_ref: 'a1', fields: { full_name: '田中健太', title: '部長' } },
      {
        ref: 'o1', book: 'opportunities', fields: { name: '商談' },
        line_items: [{ name: '商品X' }, { name: '', unit_price: '100' }],  // 2件目は名前空→除外
      },
    ]
    const nodes = buildGraphNodes(records, ALLOWED, SPECS)
    const con = nodes.find((n) => n.book === 'contacts')!
    expect(con.accountRef).toBe('a1')
    expect(con.fields.find((f) => f.apiName === 'full_name')?.value).toBe('田中健太')

    const opp = nodes.find((n) => n.book === 'opportunities')!
    expect(opp.lineItems).toEqual([{ name: '商品X', quantity: '1', unit_price: '' }])
  })

  it('読み取れないフィールドは空文字（推測で埋めない）', () => {
    const records = [{ ref: 'a1', book: 'accounts', fields: { name: 'A社' } }]
    const [a1] = buildGraphNodes(records, ALLOWED, SPECS)
    expect(a1.fields.find((f) => f.apiName === 'phone')?.value).toBe('')
    expect(a1.fields.find((f) => f.apiName === 'description')?.value).toBe('')
  })

  it('records が空配列なら空を返す', () => {
    expect(buildGraphNodes([], ALLOWED, SPECS)).toEqual([])
  })
})
