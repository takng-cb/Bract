/**
 * 行単位のテキスト差分（Wiki 版差分表示用 #129）。
 *
 * LCS（最長共通部分列）ベースの素朴な実装。Wiki 本文（高々数千行）が対象なので
 * O(n*m) で十分。巨大入力では安全弁として「全削除＋全追加」へフォールバックする。
 */

export type DiffLine = { type: 'same' | 'add' | 'del'; text: string }

const MAX_CELLS = 4_000_000  // n*m がこれを超えたら LCS を諦める（メモリ保護）

export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText === '' ? [] : oldText.split('\n')
  const b = newText === '' ? [] : newText.split('\n')
  const n = a.length, m = b.length

  if (n * m > MAX_CELLS) {
    return [
      ...a.map((text) => ({ type: 'del' as const, text })),
      ...b.map((text) => ({ type: 'add' as const, text })),
    ]
  }

  // LCS 長テーブル（(n+1) x (m+1)）
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  // バックトラックして diff 行列を構築
  const out: DiffLine[] = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] }); i++; j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i] }); i++
    } else {
      out.push({ type: 'add', text: b[j] }); j++
    }
  }
  while (i < n) { out.push({ type: 'del', text: a[i] }); i++ }
  while (j < m) { out.push({ type: 'add', text: b[j] }); j++ }
  return out
}

/** 変更行の前後 context 行だけ残して折りたたむ（間は省略マーカー）。 */
export type DiffHunkLine = DiffLine | { type: 'skip'; count: number }

export function collapseUnchanged(lines: DiffLine[], context = 2): DiffHunkLine[] {
  const keep = new Array<boolean>(lines.length).fill(false)
  lines.forEach((l, idx) => {
    if (l.type === 'same') return
    for (let k = Math.max(0, idx - context); k <= Math.min(lines.length - 1, idx + context); k++) keep[k] = true
  })
  const out: DiffHunkLine[] = []
  let skipped = 0
  for (let idx = 0; idx < lines.length; idx++) {
    if (keep[idx]) {
      if (skipped > 0) { out.push({ type: 'skip', count: skipped }); skipped = 0 }
      out.push(lines[idx])
    } else {
      skipped++
    }
  }
  if (skipped > 0) out.push({ type: 'skip', count: skipped })
  return out
}
