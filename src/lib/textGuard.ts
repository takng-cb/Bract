/**
 * AI が条件値の固有名詞を改変する事故（「福岡」→「福崎」等）への決定的ガード（REQ-0064）。
 *
 * テキスト型のフィルタ値がユーザー発話に含まれない場合、発話中の
 * 「編集距離1以内・同程度の長さ」の部分文字列に置き換える。
 * 発話に含まれていればそのまま（部分一致検索なので発話の表記が正）。
 */

/** 上限付きレーベンシュタイン距離（cap を超えたら cap+1 を返す） */
function levCapped(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      rowMin = Math.min(rowMin, cur[j])
    }
    if (rowMin > cap) return cap + 1
    prev = cur
  }
  return prev[b.length]
}

/**
 * value がユーザー発話（source）に現れない場合、発話中の最も近い部分文字列
 * （編集距離1以内）に修復して返す。見つからなければ value のまま。
 */
export function repairTextValue(value: string, source: string): string {
  const v = value.trim()
  if (!v || v.length < 2 || source.includes(v)) return value
  let best: { sub: string; dist: number } | null = null
  for (const len of [v.length, v.length + 1, v.length - 1]) {
    if (len < 2) continue
    for (let i = 0; i + len <= source.length; i++) {
      const sub = source.slice(i, i + len)
      if (/\n/.test(sub)) continue
      const d = levCapped(sub, v, 1)
      if (d <= 1 && (!best || d < best.dist)) best = { sub, dist: d }
      if (best?.dist === 0) break
    }
  }
  return best ? best.sub : value
}
