/**
 * 外部ポータル（/portal）用の読み取り専用レコードビュー（REQ-0084・Phase2）。
 * 共有された 1 レコードを、編集不可・限定フィールドで表示するためのデータを返す。
 * 対応オブジェクト（単数 api）: account / contact / opportunity / project。
 *
 * セキュリティ: 呼び出し側（portal 詳細ページ）が必ず userHasGrant で grant を検証してから呼ぶこと。
 * ここは表示用フィールドの取得のみ（権限判定はしない）。
 */
import 'server-only'
import { db } from '@/lib/db'
import { accounts, contacts, opportunities, projects } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export type PortalField = { label: string; value: string }
export type PortalRecord = { icon: string; title: string; typeLabel: string; fields: PortalField[] }

const yen = (v: unknown) => (v == null || v === '' ? '—' : `¥${Number(v).toLocaleString('ja-JP')}`)
const str = (v: unknown) => (v == null || v === '' ? '—' : String(v))

const OPP_STAGE: Record<string, string> = {
  prospecting: '見込み', qualification: '要件確認', proposal: '提案',
  negotiation: '交渉', closed_won: '受注', closed_lost: '失注',
}

export async function getPortalRecord(objectApi: string, recordId: string): Promise<PortalRecord | null> {
  switch (objectApi) {
    case 'account': {
      const [r] = await db.select().from(accounts).where(eq(accounts.id, recordId))
      if (!r) return null
      return { icon: '🏢', title: r.name, typeLabel: '取引先', fields: [
        { label: '種別', value: str(r.type) },
        { label: '業種', value: str(r.industry) },
        { label: '電話', value: str(r.phone) },
        { label: 'Web', value: str(r.website) },
        { label: '住所', value: str(r.address) },
      ] }
    }
    case 'contact': {
      const [r] = await db.select().from(contacts).where(eq(contacts.id, recordId))
      if (!r) return null
      return { icon: '👤', title: r.full_name, typeLabel: '人物', fields: [
        { label: '役職', value: str(r.title) },
        { label: 'メール', value: str(r.email) },
        { label: '電話', value: str(r.phone) },
      ] }
    }
    case 'opportunity': {
      const [r] = await db.select().from(opportunities).where(eq(opportunities.id, recordId))
      if (!r) return null
      return { icon: '💼', title: r.name, typeLabel: '商談', fields: [
        { label: 'ステージ', value: OPP_STAGE[r.stage] ?? str(r.stage) },
        { label: '金額', value: yen(r.amount) },
        { label: '完了予定日', value: str(r.close_date) },
      ] }
    }
    case 'project': {
      const [r] = await db.select().from(projects).where(eq(projects.id, recordId))
      if (!r) return null
      return { icon: '🏗️', title: r.name, typeLabel: 'プロジェクト', fields: [
        { label: 'ステータス', value: str(r.status) },
        { label: '種別', value: str(r.project_type) },
        { label: '場所', value: str(r.location) },
        { label: '開始', value: str(r.start_date) },
        { label: '完了予定', value: str(r.end_date) },
        { label: '予算', value: yen(r.budget) },
      ] }
    }
    default:
      return null
  }
}
