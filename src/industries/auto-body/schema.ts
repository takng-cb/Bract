/**
 * 板金屋・自動車整備業 (auto-body) overlay の型 re-export。
 *
 * vehicles / parts / part_movements テーブルは共通スキーマ (src/lib/schema.ts) に
 * 定義されているが、UI 側は auto-body 配下からインポートすることで
 * 「業種別データの所在」を明確化する。
 */
export { vehicles, parts, part_movements } from '@/lib/schema'
