/**
 * 板金屋・自動車整備業 (auto-body) overlay の型 re-export。
 *
 * vehicles テーブルは共通スキーマ (src/lib/schema.ts) に定義されているが、
 * UI 側は auto-body 配下からインポートすることで「業種別データの所在」を
 * 明確化する。
 */
export { vehicles } from '@/lib/schema'
