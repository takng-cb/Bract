/**
 * 統一アシスタントの読み取りツール（PoC / REQ-0088 / ADR-0032）。
 * 読み取り専用（draft-then-apply を自明に満たす）。各ツールは既存の RBAC を満たす形で実行する。
 * 書き込みツール（下書き作成等）は後続フェーズで draft-then-apply で追加。
 */
import 'server-only'
import { db } from '@/lib/db'
import { activities } from '@/lib/schema'
import { inArray, desc } from 'drizzle-orm'
import { activityIdsRelatedTo } from '@/lib/relatedRecords'
import { quickRelatedSearch } from '@/app/actions/quickAi'
import type { AgentTool } from './types'

export async function buildAssistantTools(): Promise<AgentTool[]> {
  return [
    {
      name: 'search_records',
      description: '名前で取引先・人物・商談（有効なら整備・案件）を横断検索して候補（object_api と id）を返す',
      args: '{ "query": string }',
      run: async (args) => {
        const q = typeof args.query === 'string' ? args.query.trim() : ''
        if (!q) return { error: 'query が必要です' }
        const hits = await quickRelatedSearch(q)  // 内部で canEdit を満たさなければ [] を返す
        return hits.slice(0, 8).map((h) => ({ object_api: h.object_api, id: h.record_id, label: h.label, kind: h.kind }))
      },
    },
    {
      name: 'get_activities',
      description: '指定レコード（object_api と record_id）に紐づく最近の活動履歴を返す。object_api は account/contact/opportunity 等',
      args: '{ "object_api": string, "record_id": string }',
      run: async (args) => {
        const api = typeof args.object_api === 'string' ? args.object_api.trim() : ''
        const id = typeof args.record_id === 'string' ? args.record_id.trim() : ''
        if (!api || !id) return { error: 'object_api と record_id が必要です' }
        const rows = await db
          .select({ subject: activities.subject, type: activities.type, occurred_at: activities.occurred_at, body: activities.body })
          .from(activities)
          .where(inArray(activities.id, activityIdsRelatedTo(api, id)))
          .orderBy(desc(activities.occurred_at))
          .limit(10)
        return rows.map((r) => ({
          subject: r.subject,
          type: r.type,
          date: r.occurred_at ? new Date(r.occurred_at).toISOString().slice(0, 10) : null,
          body: (r.body ?? '').slice(0, 200),
        }))
      },
    },
  ]
}
