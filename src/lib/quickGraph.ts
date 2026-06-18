/**
 * ディールグラフ抽出の純粋ロジック（REQ-0086 / ADR-0031）。
 *
 * AI の JSON 応答（records[]）→ 確認画面用ノード配列への変換を、ネットワーク/DB/認証から
 * 切り離した純粋関数として実装する（ユニットテスト可能にするため）。
 * 既存レコード照合（DB 参照）は呼び出し側（quickAi.ts）で別途付与する。
 */

/** 商談ステージの正規値（accounts/dashboard/forecast の表示ラベルと一致する英語値）。 */
export const OPP_STAGES = new Set(['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'])

export type GraphFieldSpec = { apiName: string; label: string; fieldType: string; options?: string[] }
export type GraphFieldValue = { apiName: string; label: string; fieldType: string; value: string; options?: string[] }
export type GraphLineItem = { name: string; quantity: string; unit_price: string }

export type ParsedGraphNode = {
  ref: string
  book: string
  bookLabel: string
  fields: GraphFieldValue[]
  accountRef?: string | null
  contactRef?: string | null
  relatedRefs?: string[]
  lineItems?: GraphLineItem[]
}

export type GraphBookSpec = { label: string; fields: GraphFieldSpec[] }

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/**
 * AI の records[] を確認画面用ノードに変換する（純粋）。
 * - allowed に無い book のレコードは破棄
 * - ref 未指定は採番、重複は一意化
 * - stage は正規値以外を空に
 * - contacts は account_ref、opportunities は account_ref/contact_ref/line_items、
 *   activities/tasks は related_refs を取り込む
 */
export function buildGraphNodes(
  rawRecords: unknown[],
  allowed: string[],
  specsByBook: Record<string, GraphBookSpec>,
): ParsedGraphNode[] {
  const nodes: ParsedGraphNode[] = []
  const usedRefs = new Set<string>()
  for (const rec of rawRecords) {
    const r = (rec ?? {}) as Record<string, unknown>
    const book = typeof r.book === 'string' ? r.book : ''
    if (!allowed.includes(book) || !specsByBook[book]) continue
    let ref = typeof r.ref === 'string' && r.ref.trim() ? r.ref.trim() : `n${nodes.length + 1}`
    while (usedRefs.has(ref)) ref = `${ref}_`
    usedRefs.add(ref)

    const valueMap = (r.fields ?? {}) as Record<string, unknown>
    const spec = specsByBook[book]
    const fields: GraphFieldValue[] = spec.fields.map((f) => {
      const raw = valueMap[f.apiName]
      let val = raw == null ? '' : String(raw)
      if (f.apiName === 'stage' && val && !OPP_STAGES.has(val)) val = ''
      return { apiName: f.apiName, label: f.label, fieldType: f.fieldType, value: val, options: f.options }
    })

    const node: ParsedGraphNode = { ref, book, bookLabel: spec.label, fields }
    if (book === 'contacts') node.accountRef = strOrNull(r.account_ref)
    if (book === 'opportunities') {
      node.accountRef = strOrNull(r.account_ref)
      node.contactRef = strOrNull(r.contact_ref)
      node.lineItems = Array.isArray(r.line_items)
        ? (r.line_items as unknown[]).map((li) => {
            const o = (li ?? {}) as Record<string, unknown>
            return {
              name: typeof o.name === 'string' ? o.name : '',
              quantity: o.quantity == null ? '1' : String(o.quantity),
              unit_price: o.unit_price == null ? '' : String(o.unit_price),
            }
          }).filter((li) => li.name.trim())
        : []
    }
    if (book === 'activities' || book === 'tasks') {
      node.relatedRefs = Array.isArray(r.related_refs)
        ? (r.related_refs as unknown[]).filter((s): s is string => typeof s === 'string')
        : []
    }
    nodes.push(node)
  }
  return nodes
}
