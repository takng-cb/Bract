'use server'

/**
 * 統一アシスタント（エージェント）の実行アクション（PoC / REQ-0088 / ADR-0032）。
 * 自然文の依頼を受け、読み取りツールを使って多段で回答する。
 * 書き込みは行わない（PoC は読み取り専用＝draft-then-apply を自明に満たす）。
 */
import { canEdit } from '@/lib/auth'
import { assertAiRateLimit } from '@/lib/ai/rateLimit'
import { callAI } from '@/lib/ai/client'
import { runAgent } from '@/lib/ai/agent/runner'
import { buildAssistantTools } from '@/lib/ai/agent/tools'

export type AssistantResult =
  | { ok: true; answer: string; usedTools: string[] }
  | { ok: false; error: string }

export async function assistantAsk(message: string): Promise<AssistantResult> {
  try {
    if (!(await canEdit())) return { ok: false, error: '権限がありません' }
    const msg = (message ?? '').trim()
    if (!msg) return { ok: false, error: '依頼を入力してください' }
    await assertAiRateLimit()

    const tools = await buildAssistantTools()
    const complete = async (system: string, user: string) =>
      (await callAI({ system, user, maxTokens: 1200, temperature: 0, timeoutMs: 45000 })).text

    const result = await runAgent({ message: msg, tools, complete, maxSteps: 5 })
    const usedTools = result.steps
      .filter((s): s is Extract<typeof s, { kind: 'tool' }> => s.kind === 'tool')
      .map((s) => s.tool)
    return { ok: true, answer: result.answer, usedTools }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
