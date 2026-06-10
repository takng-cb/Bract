/**
 * 数式フィールドの評価ユーティリティ
 *
 * 式の中に含まれる識別子（フィールド API名）を values から解決し、
 * 四則演算を安全に評価して結果の文字列を返す。
 *
 * 対応演算子: + - * / ( ) %
 * 数値のみ対応（文字列フィールドは 0 として扱う）
 */

/**
 * フィールド値のマップを受け取り、数式を評価して結果を返す。
 * エラー時・非数値結果時は '' を返す。
 */
export function evalFormula(
  expression: string,
  values: Record<string, unknown>,
): string {
  if (!expression.trim()) return ''

  try {
    // 識別子（[a-zA-Z_][a-zA-Z0-9_]*）をフィールド値で置換
    const substituted = expression.replace(
      /[a-zA-Z_][a-zA-Z0-9_]*/g,
      (name) => {
        const v = values[name]
        if (v === null || v === undefined || v === '') return '0'
        const n = Number(v)
        return isNaN(n) ? '0' : String(n)
      },
    )

    // 安全チェック: 数字・演算子・空白・括弧・小数点のみ許可
    if (/[^0-9+\-*/().\s%]/.test(substituted)) return ''

    const result = new Function(`return (${substituted})`)() as unknown

    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) return ''

    // 小数点以下が不要なら整数表示
    return Number.isInteger(result) ? String(result) : result.toFixed(2).replace(/\.?0+$/, '')
  } catch {
    return ''
  }
}
