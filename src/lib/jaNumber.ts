/**
 * 日本語の数量単位（万・億・千）を数値表記に正規化する（REQ-0060）。
 *
 * AI 検索で「100万円以上」を LLM が 100000 と誤変換する事故の対策。
 * プロンプトのルールだけでは桁誤りが残ったため、AI に渡す前に決定的に変換する。
 * 対象は「数字＋単位」の形のみ（「数万円」のような不定量は変換しない）。
 */
export function normalizeJaNumbers(text: string): string {
  return text
    // 1億 / 2.5億 / 1億5000万（億＋万の複合）
    .replace(/(\d+(?:\.\d+)?)億(?:(\d+(?:\.\d+)?)万)?/g, (_m, oku: string, man?: string) =>
      String(Math.round(Number(oku) * 1e8 + (man ? Number(man) * 1e4 : 0))))
    // 100万 / 1.5万
    .replace(/(\d+(?:\.\d+)?)万/g, (_m, n: string) => String(Math.round(Number(n) * 1e4)))
    // 3千 / 1.5千
    .replace(/(\d+(?:\.\d+)?)千/g, (_m, n: string) => String(Math.round(Number(n) * 1e3)))
}
