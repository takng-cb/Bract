'use server'

/**
 * staffing クイック登録（②AIウィザード / REQ-0016・REQ-0004・ADR-0004/0012）
 *
 * 貼付テキスト → AI(Groq等) で構造化 → 確認画面 → apply で案件起票（draft-then-apply）。
 * AI は DB を直接触らず、apply 層（本ファイル）が requireEditor + ensureModuleEnabled を通して反映。
 */
import { db } from '@/lib/db'
import { assignments, accounts, contacts, activities, activity_related_records } from '@/lib/schema'
import { requireEditor, getCurrentUserId } from '@/lib/auth'
import { ensureModuleEnabled } from '@/lib/modules/registry'
import { callAI } from '@/lib/ai/client'
import { generateAssignmentNo } from '@/industries/staffing/lib/assignmentNo'
import { revalidatePath } from 'next/cache'
import { eq, or, isNull, asc, sql } from 'drizzle-orm'

/** 取引先（クライアント）選択肢を返す（既存指定用） */
export async function listClientAccounts(): Promise<{ id: string; name: string }[]> {
  await requireEditor()
  await ensureModuleEnabled('staffing')
  const rows = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(or(eq(accounts.account_role, 'client'), eq(accounts.account_role, 'both'), isNull(accounts.account_role)))
    .orderBy(asc(accounts.name))
  return rows
}

/** 指定取引先の人物(担当者)一覧（既存取引先に担当者を選ぶ/追加するため） */
export async function listContactsForAccount(accountId: string): Promise<{ id: string; full_name: string }[]> {
  await requireEditor()
  await ensureModuleEnabled('staffing')
  if (!accountId) return []
  return db
    .select({ id: contacts.id, full_name: contacts.full_name })
    .from(contacts)
    .where(eq(contacts.account_id, accountId))
    .orderBy(asc(contacts.full_name))
}

/** 同名の取引先候補を返す（新規入力時の重複確認用・大文字小文字無視） */
export async function findClientAccountsByName(name: string): Promise<{ id: string; name: string }[]> {
  await requireEditor()
  await ensureModuleEnabled('staffing')
  const q = (name ?? '').trim()
  if (!q) return []
  return db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(eq(sql`lower(${accounts.name})`, q.toLowerCase()))
    .orderBy(asc(accounts.name))
}

/** 新規取引先の入力 */
export type NewClientInput = {
  name: string
  phone?: string | null
  line_type?: string | null
  /** 同名取引先があっても「別の取引先として登録」をユーザーが選んだ場合のみ true */
  allowDuplicate?: boolean
}

/** 担当者(人物)の指定方法 */
export type ContactChoice =
  | { mode: 'none' }
  | { mode: 'existing'; contactId: string }
  | { mode: 'new'; name: string; phone?: string | null }

/** 取引先の指定方法（担当者の指定を内包） */
export type ClientChoice =
  | { mode: 'existing'; clientId: string; contact: ContactChoice }
  | { mode: 'new'; newClient: NewClientInput; contact: ContactChoice }

/** AI が返す下書きの型（確認画面で編集後に apply へ渡す） */
export type StaffingDraft = {
  intent?: string
  role?: string
  headcount?: number | null
  work_date?: string | null     // YYYY-MM-DD
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  client_rate?: number | null   // 発注単価
  client_name?: string | null
  note?: string | null
  ambiguities?: string[]
}

function todayISO(): string {
  // サーバー時刻（JST想定）— 相対日付解決の基準
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 貼付テキストを AI で構造化（DBは触らない） */
export async function parseQuickText(rawText: string): Promise<StaffingDraft> {
  await requireEditor()
  await ensureModuleEnabled('staffing')

  const text = (rawText ?? '').trim()
  if (!text) throw new Error('テキストが空です')

  const system = [
    'あなたは人材手配会社の受付アシスタントです。',
    'クライアントからの依頼文（LINE等）から、案件情報を抽出して**厳密なJSONのみ**を返してください。',
    '前置き・説明・マークダウンのコードフェンスは一切付けないこと。',
    `現在日時の基準は ${todayISO()} です。「明日」「来週」等の相対表現は YYYY-MM-DD の絶対日付へ解決してください。`,
    '金額表現（「2万」等）は数値（円）へ正規化してください（例: 20000）。',
    '出力するJSONの形:',
    '{',
    '  "intent": "new_job",',
    '  "role": "募集職種や内容(文字列, 不明はnull)",',
    '  "headcount": 人数(整数, 不明はnull),',
    '  "work_date": "YYYY-MM-DD or null",',
    '  "start_time": "HH:MM or null",',
    '  "end_time": "HH:MM or null",',
    '  "location": "場所 or null",',
    '  "client_rate": 発注単価(数値 or null),',
    '  "client_name": "クライアント名 or null",',
    '  "note": "補足 or null",',
    '  "ambiguities": ["曖昧だった点(あれば)"]',
    '}',
  ].join('\n')

  const result = await callAI({ system, user: text, temperature: 0.1, maxTokens: 800 })

  // ```json フェンス等が混じった場合に備えて最初の { ... } を抽出
  const raw = result.text ?? ''
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) {
    throw new Error('AI応答をJSONとして解釈できませんでした。文面を変えて再実行してください。')
  }
  let parsed: StaffingDraft
  try {
    parsed = JSON.parse(raw.slice(start, end + 1)) as StaffingDraft
  } catch {
    throw new Error('AI応答のJSON解析に失敗しました。再実行してください。')
  }
  return parsed
}

/** 取引先名＋日付＋内容 で分かりやすいタイトルを生成（REQ-0017） */
function buildAssignmentTitle(clientName: string, draft: StaffingDraft): string {
  const parts = [
    clientName || '取引先未定',
    draft.work_date || '日付未定',
    draft.role || draft.location || '案件',
  ]
  return parts.filter(Boolean).join(' ')
}

/**
 * 確認済みの下書きから案件を起票（apply層）。新規 assignment の id を返す。
 * client: 既存(取引先ID) or 新規(取引先情報) を**先に**指定する（REQ-0017）。
 */
export async function applyQuickDraft(client: ClientChoice, draft: StaffingDraft, rawText: string): Promise<string> {
  await requireEditor()
  await ensureModuleEnabled('staffing')
  const ownerId = await getCurrentUserId()

  // ── 取引先を解決（既存=ID / 新規=作成＋重複防止）。タイトル用に名前も得る。──
  let clientAccountId: string
  let clientName: string
  let clientContactId: string | null = null
  if (client.mode === 'existing') {
    if (!client.clientId) throw new Error('取引先を選択してください')
    const [acc] = await db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.id, client.clientId)).limit(1)
    if (!acc) throw new Error('選択した取引先が見つかりません')
    clientAccountId = acc.id
    clientName = acc.name
  } else {
    const name = (client.newClient?.name ?? '').trim()
    if (!name) throw new Error('新規取引先の名称は必須です')
    // 重複確認：同名の取引先があれば既定では作成せず、確認画面で明示的に許可された時のみ新規作成
    if (!client.newClient?.allowDuplicate) {
      const [dup] = await db.select({ id: accounts.id }).from(accounts).where(eq(sql`lower(${accounts.name})`, name.toLowerCase())).limit(1)
      if (dup) throw new Error(`「${name}」と同名の取引先が既にあります。確認画面で「既存を使う」か「別の取引先として登録」を選んでください。`)
    }
    const newContactName = client.contact.mode === 'new' ? (client.contact.name ?? '').trim() : ''
    const [acc] = await db.insert(accounts).values({
      name,
      account_role:   'client',
      contact_person: newContactName || null,
      phone:          client.newClient?.phone ?? null,
      line_type:      client.newClient?.line_type ?? null,
    }).returning({ id: accounts.id })
    clientAccountId = acc.id
    clientName = name
  }

  // ── 担当者(人物)を解決（既存選択 / 新規作成 / なし）。既存取引先＋新規担当者も重複なく対応。──
  const cc = client.contact
  if (cc.mode === 'existing') {
    clientContactId = cc.contactId || null
  } else if (cc.mode === 'new') {
    const cname = (cc.name ?? '').trim()
    if (cname) {
      const [con] = await db.insert(contacts).values({
        account_id:   clientAccountId,
        full_name:    cname,
        phone:        cc.phone ?? null,
        contact_type: 'business',
      }).returning({ id: contacts.id })
      clientContactId = con.id
    }
  }

  const title = buildAssignmentTitle(clientName, draft)
  const memoParts = [
    draft.note ? `補足: ${draft.note}` : null,
    draft.ambiguities && draft.ambiguities.length ? `要確認: ${draft.ambiguities.join(' / ')}` : null,
  ].filter(Boolean)

  let lastErr: unknown = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const no = await generateAssignmentNo()
    try {
      const [row] = await db.insert(assignments).values({
        assignment_no:        no,
        title,
        client_account_id:    clientAccountId,
        client_contact_id:    clientContactId,
        role:                 draft.role ?? null,
        service_date:         draft.work_date ?? null,
        service_start_time:   draft.start_time ?? null,
        service_end_time:     draft.end_time ?? null,
        service_location:     draft.location ?? null,
        service_description:  draft.role ?? null,
        staff_count_required: typeof draft.headcount === 'number' ? draft.headcount : null,
        client_total_fee:     draft.client_rate != null ? String(draft.client_rate) : null,
        status:               '受付',
        internal_memo:        memoParts.join('\n') || null,
        raw_message:          rawText ?? null,
      }).returning({ id: assignments.id })
      const assignmentId = row.id

      // 原文を「活動(メモ)」として記録し、取引先・担当者・案件に紐付ける（REQ-0017）
      const text = (rawText ?? '').trim()
      if (text) {
        try {
          const [act] = await db.insert(activities).values({
            type:        'note',
            subject:     `クイック登録: ${title}`,
            body:        text,
            owner_id:    ownerId,
          }).returning({ id: activities.id })
          const links: { activity_id: string; related_object_api: string; related_record_id: string }[] = [
            { activity_id: act.id, related_object_api: 'account',    related_record_id: clientAccountId },
            { activity_id: act.id, related_object_api: 'assignment', related_record_id: assignmentId },
          ]
          if (clientContactId) links.push({ activity_id: act.id, related_object_api: 'contact', related_record_id: clientContactId })
          await db.insert(activity_related_records).values(links).onConflictDoNothing()
        } catch {
          // 活動記録の失敗は起票自体を妨げない（best-effort）
        }
      }

      revalidatePath('/assignments')
      revalidatePath('/activities')
      return assignmentId
    } catch (e) {
      lastErr = e
      const msg = e instanceof Error ? e.message : String(e)
      if (!/assignment_no|unique|duplicate/i.test(msg)) throw e
    }
  }
  throw new Error('案件番号の採番に失敗しました。再度お試しください。' + (lastErr ? ` (${(lastErr as Error).message})` : ''))
}
