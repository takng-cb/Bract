/**
 * レコード新規作成時の重複検出（REQ-0018 / ADR-0013）
 *
 * 各オブジェクトの「自然キー」で既存レコードを探し、見つかれば確認画面用の候補を返す。
 * フォームの hidden 入力 `__allow_duplicate=1`（= 確認画面で「それでも新規作成」を選択）が
 * 立っている場合は検査をスキップして作成を通す。
 *
 * サーバー専用モジュール（db を import）。クライアントからは import しないこと。
 * 型だけ必要なら `@/lib/duplicateTypes` を使う。
 */
import { db } from '@/lib/db'
import {
  accounts, contacts, opportunities, assignments, vehicles, parts, book_records,
} from '@/lib/schema'
import { properties, projects } from '@/industries/real-estate/schema'
import { and, eq, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { withSaveToast } from '@/lib/saveToast'
import { getBookDef, getFieldDefs } from '@/lib/bookMetadata'
import { buildAssignmentTitle } from '@/industries/staffing/lib/assignmentTitle'
import type { CreateState, DupCandidate } from '@/lib/duplicateTypes'

const LIMIT = 5

function s(formData: FormData, key: string): string {
  return ((formData.get(key) as string) ?? '').trim()
}

/** オブジェクトごとの自然キー検査。空キー時は [] を返す（＝検査対象なし） */
const RULES: Record<string, (fd: FormData) => Promise<DupCandidate[]>> = {
  accounts: async (fd) => {
    const name = s(fd, 'name')
    if (!name) return []
    const rows = await db.select({ id: accounts.id, name: accounts.name }).from(accounts)
      .where(eq(sql`lower(${accounts.name})`, name.toLowerCase())).limit(LIMIT)
    return rows.map((r) => ({ id: r.id, label: r.name, href: `/accounts/${r.id}` }))
  },

  contacts: async (fd) => {
    const name = s(fd, 'full_name')
    if (!name) return []
    const accountId = s(fd, 'account_id') || null
    const conds = [eq(sql`lower(${contacts.full_name})`, name.toLowerCase())]
    if (accountId) conds.push(eq(contacts.account_id, accountId))
    const rows = await db.select({ id: contacts.id, full_name: contacts.full_name }).from(contacts)
      .where(and(...conds)).limit(LIMIT)
    return rows.map((r) => ({ id: r.id, label: r.full_name, href: `/contacts/${r.id}` }))
  },

  opportunities: async (fd) => {
    const name = s(fd, 'name')
    if (!name) return []
    const accountId = s(fd, 'account_id') || null
    const conds = [eq(sql`lower(${opportunities.name})`, name.toLowerCase())]
    if (accountId) conds.push(eq(opportunities.account_id, accountId))
    const rows = await db.select({ id: opportunities.id, name: opportunities.name }).from(opportunities)
      .where(and(...conds)).limit(LIMIT)
    return rows.map((r) => ({ id: r.id, label: r.name, href: `/opportunities/${r.id}` }))
  },

  // 案件：タイトル完全一致（取引先名＋日付＋内容）。createAssignment も同じ規則で title を保存する。
  assignments: async (fd) => {
    const clientId = s(fd, 'client_account_id')
    if (!clientId) return []
    const [acc] = await db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, clientId)).limit(1)
    const title = buildAssignmentTitle(acc?.name ?? '', {
      work_date: s(fd, 'service_date') || null,
      content: s(fd, 'service_description') || s(fd, 'service_type') || s(fd, 'service_location') || null,
    })
    const rows = await db.select({ id: assignments.id, title: assignments.title, no: assignments.assignment_no }).from(assignments)
      .where(eq(sql`lower(${assignments.title})`, title.toLowerCase())).limit(LIMIT)
    return rows.map((r) => ({ id: r.id, label: r.title ?? r.no, href: `/assignments/${r.id}` }))
  },

  vehicles: async (fd) => {
    const plate = s(fd, 'license_plate')
    const vin = s(fd, 'vin')
    if (!plate && !vin) return []
    const cond = plate
      ? eq(sql`lower(${vehicles.license_plate})`, plate.toLowerCase())
      : eq(sql`lower(${vehicles.vin})`, vin.toLowerCase())
    const rows = await db.select({ id: vehicles.id, maker: vehicles.maker, model: vehicles.model, license_plate: vehicles.license_plate, vin: vehicles.vin }).from(vehicles)
      .where(cond).limit(LIMIT)
    return rows.map((r) => ({ id: r.id, label: `${r.maker} ${r.model}（${r.license_plate || r.vin || ''}）`, href: `/vehicles/${r.id}` }))
  },

  parts: async (fd) => {
    const pn = s(fd, 'part_number')
    if (!pn) return []
    const rows = await db.select({ id: parts.id, part_number: parts.part_number, name: parts.name }).from(parts)
      .where(eq(sql`lower(${parts.part_number})`, pn.toLowerCase())).limit(LIMIT)
    return rows.map((r) => ({ id: r.id, label: `${r.part_number} ${r.name}`, href: `/parts/${r.id}` }))
  },

  properties: async (fd) => {
    const name = s(fd, 'name')
    if (!name) return []
    const rows = await db.select({ id: properties.id, name: properties.name }).from(properties)
      .where(eq(sql`lower(${properties.name})`, name.toLowerCase())).limit(LIMIT)
    return rows.map((r) => ({ id: r.id, label: r.name, href: `/properties/${r.id}` }))
  },

  projects: async (fd) => {
    const name = s(fd, 'name')
    if (!name) return []
    const rows = await db.select({ id: projects.id, name: projects.name }).from(projects)
      .where(eq(sql`lower(${projects.name})`, name.toLowerCase())).limit(LIMIT)
    return rows.map((r) => ({ id: r.id, label: r.name, href: `/projects/${r.id}` }))
  },
}

/** カスタムブック：先頭フィールド（主フィールド）の値が一致する既存レコードを探す */
async function checkCustomDuplicates(bookApiName: string, fd: FormData): Promise<DupCandidate[]> {
  const obj = await getBookDef(bookApiName)
  if (!obj) return []
  const fields = await getFieldDefs(obj.id)
  const nameField = fields[0]   // sort_order 先頭＝主フィールド（一覧でリンク表示される名称）
  if (!nameField) return []
  const value = s(fd, nameField.api_name)
  if (!value) return []
  const rows = await db.select({ id: book_records.id }).from(book_records)
    .where(and(
      eq(book_records.object_id, obj.id),
      sql`lower(${book_records.data} ->> ${nameField.api_name}) = ${value.toLowerCase()}`,
    )).limit(LIMIT)
  return rows.map((r) => ({ id: r.id, label: value, href: `/books/${bookApiName}/${r.id}` }))
}

/**
 * 重複候補を返す。`objectKey` は組み込みは表名（'accounts' 等）、
 * カスタムは `custom:<apiName>`。`__allow_duplicate=1` ならスキップ。
 */
export async function checkDuplicates(objectKey: string, formData: FormData): Promise<DupCandidate[]> {
  if (s(formData, '__allow_duplicate') === '1') return []
  if (objectKey.startsWith('custom:')) return checkCustomDuplicates(objectKey.slice('custom:'.length), formData)
  const rule = RULES[objectKey]
  if (!rule) return []
  return rule(formData)
}

/**
 * create アクションの共通ラッパー：重複検査 → 作成 → redirect。
 * 重複時は確認 state を、エラー時は赤帯 state を返す（成功時は redirect で離脱）。
 */
export async function runCreate(opts: {
  objectKey: string
  objectLabel: string
  formData: FormData
  create: () => Promise<string>
  redirectTo: (id: string) => string
  afterCreate?: (id: string) => Promise<void>
}): Promise<CreateState> {
  try {
    const dups = await checkDuplicates(opts.objectKey, opts.formData)
    if (dups.length > 0) return { kind: 'duplicate', objectLabel: opts.objectLabel, candidates: dups }
    const id = await opts.create()
    if (opts.afterCreate) await opts.afterCreate(id)
    redirect(withSaveToast(opts.redirectTo(id), 'created'))  // 遷移後に「作成しました」トースト（REQ-0057）
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e
    return { kind: 'error', message: (e as Error).message }
  }
}
