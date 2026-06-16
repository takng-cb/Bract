/**
 * PLAUD Note のエクスポート markdown/テキストをパースする（#143 / REQ-0077）。
 * サーバ取得（Cloudflare で本番ブロック）はやめ、ユーザーがエクスポートした
 * markdown をアップロード→パースする方式。純粋関数なのでテスト可能。
 *
 * 想定構造:
 *   # タイトル
 *   [Image] / 概要段落
 *   ------------
 *   ## セクション見出し
 *   本文…
 *   ------------
 *   ## アクションアイテム
 *   ### @担当者
 *   - [ ] タスク - [TBD]
 */

export type PlaudActionItem = { person: string; task: string; status: string }

export type PlaudMarkdown = {
  title: string
  /** 見出し付きセクション本文（アクションアイテム以外） */
  summary: string
  actionItems: PlaudActionItem[]
  /** 活動本文用に整形した digest（summary ＋ アクションアイテム） */
  body: string
}

export class PlaudParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlaudParseError'
  }
}

const SEP_RE = /^[-—_=]{3,}\s*$/        // 区切り線
const H1_RE = /^#\s+(.+?)\s*$/
const H2_RE = /^##\s+(.+?)\s*$/
const PERSON_RE = /^###\s+@?\s*(.+?)\s*$/
// - [ ] タスク - [ステータス]   /  - タスク
const TASK_RE = /^[-*]\s*(?:\[.?\]\s*)?(.*?)\s*(?:[-–]\s*\[(.+?)\]\s*)?$/

function isActionHeading(h: string): boolean {
  return /アクション|action\s*item|todo|to-?do|タスク/i.test(h)
}

export function parsePlaudMarkdown(input: string): PlaudMarkdown {
  if (!input || !input.trim()) throw new PlaudParseError('ファイルが空です')
  const lines = input.replace(/\r\n?/g, '\n').split('\n')

  let title = ''
  const summaryParts: string[] = []
  const actionItems: PlaudActionItem[] = []

  let inAction = false
  let currentPerson = ''
  let currentHeading = ''
  let buf: string[] = []

  const flushSection = () => {
    const text = buf.join('\n').trim()
    if (currentHeading) summaryParts.push(`## ${currentHeading}\n${text}`.trim())
    else if (text) summaryParts.push(text)
    buf = []
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '')
    if (line.trim() === '' && buf.length === 0) continue
    if (SEP_RE.test(line.trim())) { continue }
    if (line.trim() === '[Image]' || line.trim() === '![Image]') continue

    const h1 = line.match(H1_RE)
    if (h1) {
      // 先頭の # タイトル（重複することがあるので最初だけ採用）
      if (!title) title = h1[1].trim()
      continue
    }

    const h2 = line.match(H2_RE)
    if (h2) {
      if (!inAction) flushSection()
      const heading = h2[1].trim()
      if (isActionHeading(heading)) {
        if (!inAction) flushSection()
        inAction = true
        currentPerson = ''
        currentHeading = ''
        continue
      }
      currentHeading = heading
      continue
    }

    if (inAction) {
      const p = line.match(PERSON_RE)
      if (p) { currentPerson = p[1].trim(); continue }
      const t = line.match(TASK_RE)
      if (t && t[1] && t[1].trim()) {
        actionItems.push({ person: currentPerson, task: t[1].trim(), status: (t[2] || '').trim() })
      }
      continue
    }

    buf.push(line)
  }
  if (!inAction) flushSection()

  const summary = summaryParts.join('\n\n').trim()

  if (!title && !summary && actionItems.length === 0) {
    throw new PlaudParseError('PLAUD のエクスポート内容を読み取れませんでした（# 見出しや本文が見つかりません）')
  }

  // 活動本文 digest
  const bodyParts: string[] = []
  if (summary) bodyParts.push(summary)
  if (actionItems.length > 0) {
    const byPerson = new Map<string, string[]>()
    for (const a of actionItems) {
      const key = a.person || '（担当未設定）'
      const mark = /完了|done|済/i.test(a.status) ? '✓ ' : ''
      const tail = a.status && !/完了|done|済/i.test(a.status) ? `（${a.status}）` : ''
      const arr = byPerson.get(key) ?? []
      arr.push(`- ${mark}${a.task}${tail}`)
      byPerson.set(key, arr)
    }
    const lines2 = ['## アクションアイテム']
    for (const [person, tasks] of byPerson) {
      lines2.push(`### @${person}`)
      lines2.push(...tasks)
    }
    bodyParts.push(lines2.join('\n'))
  }

  return { title: title || '（無題）', summary, actionItems, body: bodyParts.join('\n\n').trim() }
}
