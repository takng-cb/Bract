/**
 * 顧客車両の「車体の形状」(body_shape) リストと SVG シルエットへのマッピング。
 *
 * リスト: 日本の自動車整備で一般的な乗用車・商用車・トラック・バスを網羅。
 * SVG family: 形状ごとに描画パターンを 1 つ持ち、複数の車体形状を 1 ファミリに
 *             統合（例: セダンとクーペは同じシルエットを使う）。
 */

/** UI のドロップダウンに表示する車体形状（順番が表示順） */
export const VEHICLE_BODY_SHAPES = [
  // 乗用車
  'セダン',
  'クーペ',
  'ハッチバック',
  'ステーションワゴン',
  'SUV',
  'ミニバン',
  '軽自動車',
  'オープンカー',
  // トラック・商用車
  '軽トラック',
  '平ボディトラック',
  'バントラック',
  'ダンプトラック',
  // バス
  'マイクロバス',
  'バス',
  // その他
  'その他',
] as const

export type VehicleBodyShape = (typeof VEHICLE_BODY_SHAPES)[number]

/**
 * 損傷マップで使う SVG シルエットの種類。
 * 各 family ごとに見た目を変える（俯瞰・前・後・左/右）。
 */
export type BodySvgFamily =
  | 'sedan'       // セダン・クーペ・軽自動車
  | 'wagon'       // ハッチバック・ステーションワゴン・SUV・ミニバン
  | 'open'        // オープンカー
  | 'pickup'      // 軽トラック・平ボディ・ダンプ
  | 'van'         // バントラック
  | 'bus'         // マイクロバス・バス

const FAMILY_MAP: Record<string, BodySvgFamily> = {
  'セダン':              'sedan',
  'クーペ':              'sedan',
  '軽自動車':            'sedan',
  'ハッチバック':        'wagon',
  'ステーションワゴン':  'wagon',
  'SUV':                 'wagon',
  'ミニバン':            'wagon',
  'オープンカー':        'open',
  '軽トラック':          'pickup',
  '平ボディトラック':    'pickup',
  'ダンプトラック':      'pickup',
  'バントラック':        'van',
  'マイクロバス':        'bus',
  'バス':                'bus',
}

/**
 * body_shape 文字列から SVG 描画ファミリを引く。未指定 / その他はセダン扱い。
 */
export function bodyShapeFamily(shape: string | null | undefined): BodySvgFamily {
  if (!shape) return 'sedan'
  return FAMILY_MAP[shape] ?? 'sedan'
}
