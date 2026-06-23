import { describe, it, expect } from 'vitest'
import { parseAgentAction, buildAgentSystem, runAgent } from './runner'
import type { AgentTool, CompleteFn } from './types'

/** 応答キューを順に返す擬似モデル（キー不要・決定論的）。 */
function scriptedComplete(responses: string[]): CompleteFn {
  let i = 0
  return async () => responses[Math.min(i++, responses.length - 1)]
}

const searchCalls: Record<string, unknown>[] = []
const searchTool: AgentTool = {
  name: 'search_records',
  description: '名前で取引先/人物/商談を検索',
  args: '{ query: string }',
  run: async (args) => { searchCalls.push(args); return [{ object_api: 'account', id: 'a1', label: '株式会社山田製作所' }] },
}

describe('parseAgentAction', () => {
  it('tool / final / フェンス付き / 不正 を解釈', () => {
    expect(parseAgentAction('{"action":"tool","tool":"search_records","args":{"query":"山田"}}'))
      .toEqual({ action: 'tool', tool: 'search_records', args: { query: '山田' } })
    expect(parseAgentAction('```json\n{"action":"final","answer":"完了"}\n```'))
      .toEqual({ action: 'final', answer: '完了' })
    expect(parseAgentAction('ただの文章')).toBeNull()
    expect(parseAgentAction('{"action":"tool"}')).toBeNull()  // tool 名なし
  })
})

describe('buildAgentSystem', () => {
  it('ツール名を列挙する', () => {
    const s = buildAgentSystem([searchTool])
    expect(s).toContain('search_records')
    expect(s).toContain('"action":"tool"')
  })
})

describe('runAgent', () => {
  it('ツール呼び出し→結果を踏まえて final を返す', async () => {
    searchCalls.length = 0
    const complete = scriptedComplete([
      '{"action":"tool","tool":"search_records","args":{"query":"山田"}}',
      '{"action":"final","answer":"株式会社山田製作所が見つかりました"}',
    ])
    const res = await runAgent({ message: '山田製作所を探して', tools: [searchTool], complete, maxSteps: 5 })
    expect(searchCalls).toEqual([{ query: '山田' }])
    expect(res.answer).toBe('株式会社山田製作所が見つかりました')
    expect(res.steps).toHaveLength(1)
    expect(res.steps[0]).toMatchObject({ kind: 'tool', tool: 'search_records' })
  })

  it('JSON でない応答はそのまま回答として返す', async () => {
    const res = await runAgent({ message: 'やあ', tools: [], complete: scriptedComplete(['こんにちは、ご用件は？']) })
    expect(res.answer).toBe('こんにちは、ご用件は？')
    expect(res.steps).toEqual([])
  })

  it('不明なツールはエラー観測にして続行する', async () => {
    const complete = scriptedComplete([
      '{"action":"tool","tool":"nope","args":{}}',
      '{"action":"final","answer":"代わりに回答します"}',
    ])
    const res = await runAgent({ message: 'test', tools: [searchTool], complete })
    expect(res.steps[0]).toMatchObject({ kind: 'error' })
    expect(res.answer).toBe('代わりに回答します')
  })

  it('ステップ上限で打ち切り、まとめ1回で final を返す', async () => {
    // 常にツール呼び出しを返す → 上限到達後の総括 complete で final
    let calls = 0
    const complete: CompleteFn = async () => {
      calls++
      // 上限(2)分はツール、その後の総括呼び出しで final
      return calls <= 2
        ? '{"action":"tool","tool":"search_records","args":{"query":"x"}}'
        : '{"action":"final","answer":"上限まとめ"}'
    }
    const res = await runAgent({ message: 'loop', tools: [searchTool], complete, maxSteps: 2 })
    expect(res.steps).toHaveLength(2)        // ツールは上限回数だけ
    expect(res.answer).toBe('上限まとめ')
    expect(calls).toBe(3)                     // 2回ループ + 1回総括
  })

  it('ツールが throw しても落ちずにエラー結果を観測にする', async () => {
    const boom: AgentTool = { name: 'boom', description: '', args: '{}', run: async () => { throw new Error('爆発') } }
    const complete = scriptedComplete([
      '{"action":"tool","tool":"boom","args":{}}',
      '{"action":"final","answer":"ハンドルした"}',
    ])
    const res = await runAgent({ message: 't', tools: [boom], complete })
    expect(res.steps[0]).toMatchObject({ kind: 'tool', tool: 'boom', result: { error: '爆発' } })
    expect(res.answer).toBe('ハンドルした')
  })
})
