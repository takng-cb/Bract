'use server'
/**
 * クイック操作ウィザード — 汎用 AI 作成（REQ-0022 / draft-then-apply）
 *
 * カスタムオブジェクト（custom_records ＋ field_definitions 駆動）のブックに対して、
 * 自由入力テキスト or 画像から各フィールド値を AI 抽出し、編集可能なドラフトを返す。
 * 確定値は `quickAiCreate` で custom_records に INSERT する。
 *
 * 安全方針：
 * - typed テーブル（accounts / maintenance_records 等）は対象外（個別スキーマの誤投入を避ける）。
 *   typed ブックは専用ウィザード（あれば）か手動入力に誘導する（UI 側で分岐）。
 * - AI は DB を直接触らず、抽出→確認→apply の draft-then-apply を厳守。
 */
import { db } from '@/lib/db'
import { custom_records } from '@/lib/schema'
import { canEdit, getCurrentUserId } from '@/lib/auth'
import { getObjectDef, getFieldDefs, parseFieldOptions } from '@/lib/objectMetadata'
import { callAI } from '@/lib/ai/client'

export type QuickAiField = {
  apiName: string
  label: string
  fieldType: string
  value: string
  /** select 型の選択肢 */
  options?: string[]
}

export type QuickAiDraft = {
  fields: QuickAiField[]
  /** AI が補足した注意点（曖昧さなど） */
  note?: string
}

export type QuickAiImage = { mediaType: string; dataBase64: string }

/** custom_records ベースのブックか（typed は false → AI 作成は非対応） */
export async function quickAiSupported(apiName: string): Promise<boolean> {
  const obj = await getObjectDef(apiName)
  return Boolean(obj && !obj.is_builtin)
}

/**
 * 自由入力 or 画像から、ブックの各フィールド値を抽出して編集可能ドラフトを返す。
 * カスタムオブジェクト（field_definitions あり）のみ対応。
 */
export async function quickAiExtract(
  apiName: string,
  input: { text?: string; image?: QuickAiImage },
): Promise<QuickAiDraft> {
  if (!(await canEdit())) throw new Error('権限がありません')

  const obj = await getObjectDef(apiName)
  if (!obj) throw new Error(`ブック "${apiName}" が見つかりません`)
  if (obj.is_builtin) {
    throw new Error('このブックは AI 作成に未対応です（手動入力をご利用ください）')
  }

  const fields = await getFieldDefs(obj.id)
  if (fields.length === 0) throw new Error('このブックには入力フィールドが定義されていません')

  const text = input.text?.trim() ?? ''
  if (!text && !input.image) throw new Error('テキストまたは画像を入力してください')

  // フィールド仕様を AI に提示
  const fieldSpec = fields.map((f) => {
    const opts = parseFieldOptions(f)
    const optStr = opts.length ? `（選択肢: ${opts.join(' / ')}）` : ''
    return `- ${f.api_name}: ${f.label}（型: ${f.field_type}）${optStr}`
  }).join('\n')

  const system = [
    `あなたは日本語の業務データ抽出アシスタントです。`,
    `「${obj.label}」レコードの各フィールドを、与えられた情報（テキストや画像）から抽出します。`,
    `出力は厳密な JSON のみ。前後に説明文やコードフェンスを付けないこと。`,
    `形式: {"fields": {"<api_name>": "<値の文字列>", ...}, "note": "<曖昧な点があれば短く。無ければ空文字>"}`,
    `ルール:`,
    `- 値が読み取れないフィールドは空文字 "" にする（推測で埋めない）。`,
    `- date 型は YYYY-MM-DD、number 型は数字のみ、boolean 型は "true"/"false"、select 型は選択肢のいずれかに正規化する。`,
    `- 対象フィールド以外のキーは出力しない。`,
    ``,
    `対象フィールド:`,
    fieldSpec,
  ].join('\n')

  const user = input.image
    ? (text ? `次の画像と補足テキストから抽出してください。\n補足: ${text}` : `次の画像から抽出してください。`)
    : `次のテキストから抽出してください。\n---\n${text}`

  const result = await callAI({
    system,
    user,
    images: input.image ? [input.image] : undefined,
    maxTokens: 1500,
    temperature: 0.1,
    timeoutMs: 45000,
  })

  const parsed = extractJson(result.text)
  const valueMap = (parsed?.fields ?? {}) as Record<string, unknown>

  const draftFields: QuickAiField[] = fields.map((f) => {
    const raw = valueMap[f.api_name]
    return {
      apiName: f.api_name,
      label: f.label,
      fieldType: f.field_type,
      value: raw == null ? '' : String(raw),
      options: parseFieldOptions(f),
    }
  })

  return {
    fields: draftFields,
    note: typeof parsed?.note === 'string' && parsed.note.trim() ? parsed.note.trim() : undefined,
  }
}

/** 確定値で custom_records に INSERT。レコード詳細への href を返す */
export async function quickAiCreate(
  apiName: string,
  values: Record<string, string>,
): Promise<{ recordHref: string }> {
  if (!(await canEdit())) throw new Error('権限がありません')

  const obj = await getObjectDef(apiName)
  if (!obj) throw new Error(`ブック "${apiName}" が見つかりません`)
  if (obj.is_builtin) throw new Error('このブックは AI 作成に未対応です')

  const fields = await getFieldDefs(obj.id)
  const data: Record<string, unknown> = {}
  for (const f of fields) {
    data[f.api_name] = coerceValue(f.field_type, values[f.api_name] ?? null)
  }

  const owner_id = (await getCurrentUserId()) ?? null
  const [rec] = await db.insert(custom_records)
    .values({ object_id: obj.id, data, owner_id })
    .returning({ id: custom_records.id })

  return { recordHref: `/objects/${apiName}/${rec.id}` }
}

// ── helpers ────────────────────────────────────────────────────────
function coerceValue(fieldType: string, raw: string | null): unknown {
  if (raw === null || raw.trim() === '') return null
  const s = raw.trim()
  switch (fieldType) {
    case 'number':  { const n = Number(s); return isFinite(n) ? n : null }
    case 'boolean': return s === 'on' || s === 'true' || s === '1'
    default:        return s
  }
}

/** AI 応答から JSON オブジェクトを頑健に取り出す（コードフェンス混入に耐える） */
function extractJson(text: string): { fields?: Record<string, unknown>; note?: string } | null {
  const trimmed = text.trim()
  const candidates: string[] = []
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) candidates.push(fence[1])
  const brace = trimmed.match(/\{[\s\S]*\}/)
  if (brace) candidates.push(brace[0])
  candidates.push(trimmed)
  for (const c of candidates) {
    try { return JSON.parse(c) } catch { /* try next */ }
  }
  return null
}
