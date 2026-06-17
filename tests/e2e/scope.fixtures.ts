/**
 * 社内レコードスコープ（own）E2E の共有フィクスチャ（REQ-0083）。
 * seed スクリプト（scripts/seed-scoped-data.ts）と spec（*.scoped.spec.ts）の両方が参照し、
 * 固定 UUID・マーカー名のドリフトを防ぐ。
 *
 * 構成: スコープロール「E2E自分のみ」（read/update が own）を割り当てた test-scoped ユーザーが、
 *   各ブックで「自分所有(own)」レコードだけ見え、「他人所有(other)」は一覧に出ず・直URLは404、を検証する。
 */
export const SCOPED_EMAIL = 'test-scoped@bract-crm.local'
export const SCOPED_ROLE_NAME = 'E2E自分のみ'
/** 他人所有レコードの owner_id（test-scoped 以外なら何でもよい固定値。FK 無し列）。 */
export const OTHER_OWNER_ID = '0e2e0000-0000-4000-8000-0000000000ff'

export type ScopeBook = {
  key: string
  table: string
  /** 詳細 URL セグメント /<resource>/<id> */
  resource: string
  /** 一覧 URL（必要なら view=list 等のクエリ込み） */
  listPath: string
  /** seed する表示名カラム */
  nameCol: string
  /** seed 時に追加で必要な notNull カラム（activities.type 等） */
  seedExtra?: { col: string; value: string }[]
  ownId: string
  otherId: string
  ownName: string
  otherName: string
  /** モジュール無効等で一覧に到達できない場合 skip する */
  mayBeDisabled?: boolean
}

export const SCOPE_BOOKS: ScopeBook[] = [
  { key: 'account', table: 'accounts', resource: 'accounts', listPath: '/accounts', nameCol: 'name',
    ownId: '0e2e0001-0000-4000-8000-000000000001', otherId: '0e2e0001-0000-4000-8000-000000000002',
    ownName: 'E2E自分の取引先', otherName: 'E2E他人の取引先' },
  { key: 'contact', table: 'contacts', resource: 'contacts', listPath: '/contacts', nameCol: 'full_name',
    ownId: '0e2e0002-0000-4000-8000-000000000001', otherId: '0e2e0002-0000-4000-8000-000000000002',
    ownName: 'E2E自分の人物', otherName: 'E2E他人の人物' },
  { key: 'opportunity', table: 'opportunities', resource: 'opportunities', listPath: '/opportunities?view=list', nameCol: 'name',
    ownId: '0e2e0003-0000-4000-8000-000000000001', otherId: '0e2e0003-0000-4000-8000-000000000002',
    ownName: 'E2E自分の商談', otherName: 'E2E他人の商談' },
  { key: 'activity', table: 'activities', resource: 'activities', listPath: '/activities', nameCol: 'subject',
    seedExtra: [{ col: 'type', value: 'メモ' }],
    ownId: '0e2e0004-0000-4000-8000-000000000001', otherId: '0e2e0004-0000-4000-8000-000000000002',
    ownName: 'E2E自分の活動', otherName: 'E2E他人の活動' },
  { key: 'task', table: 'tasks', resource: 'tasks', listPath: '/tasks', nameCol: 'title',
    ownId: '0e2e0005-0000-4000-8000-000000000001', otherId: '0e2e0005-0000-4000-8000-000000000002',
    ownName: 'E2E自分のToDo', otherName: 'E2E他人のToDo' },
  { key: 'project', table: 'projects', resource: 'projects', listPath: '/projects', nameCol: 'name', mayBeDisabled: true,
    ownId: '0e2e0006-0000-4000-8000-000000000001', otherId: '0e2e0006-0000-4000-8000-000000000002',
    ownName: 'E2E自分のPJ', otherName: 'E2E他人のPJ' },
]
