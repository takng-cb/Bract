/**
 * 案件(assignment)の表示名タイトルを「取引先名＋日付＋内容」で生成（REQ-0017 / REQ-0018）
 *
 * クイック登録・通常フォームの双方で同じ規則を使うことで、
 * タイトル完全一致による重複検出（ADR-0013）が両経路で一貫する。
 */
export function buildAssignmentTitle(
  clientName: string,
  opts: { work_date?: string | null; content?: string | null },
): string {
  return [
    clientName || '取引先未定',
    opts.work_date || '日付未定',
    opts.content || '案件',
  ].filter(Boolean).join(' ')
}
