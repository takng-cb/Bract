/**
 * AI 応答テキストから JSON を頑健に取り出す共通ヘルパ（REQ-0082）。
 *
 * LLM は JSON をコードフェンス（```json … ```）で包んだり、前後に説明文を付けたりする。
 * quickAi / aiSearch / plaud で個別に実装していた抽出ロジックを 1 本に集約する。
 *
 * 試行順:
 *   1. コードフェンス内（```json … ``` / ``` … ```）
 *   2. 最初の `{ … }`（オブジェクト）
 *   3. 最初の `[ … ]`（配列）
 *   4. 全体（トリム済み）
 * 最初に JSON.parse に成功した候補を返す。どれも失敗したら null。
 *
 * 純粋関数（I/O なし）。サーバ/テストの両方から使える。
 */
export function extractJson<T = unknown>(text: string): T | null {
  const trimmed = text.trim()
  const candidates: string[] = []
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) candidates.push(fence[1])
  const brace = trimmed.match(/\{[\s\S]*\}/)
  if (brace) candidates.push(brace[0])
  const bracket = trimmed.match(/\[[\s\S]*\]/)
  if (bracket) candidates.push(bracket[0])
  candidates.push(trimmed)
  for (const c of candidates) {
    try {
      return JSON.parse(c) as T
    } catch {
      /* 次の候補へ */
    }
  }
  return null
}

/** オブジェクト形を期待する版。配列・スカラー・null は弾く。 */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  const v = extractJson(text)
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}
