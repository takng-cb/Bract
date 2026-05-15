/**
 * 板金屋・自動車整備業 (auto-body) overlay の型 re-export。
 *
 * 共通スキーマ (src/lib/schema.ts) に定義されたテーブルを、業種別 UI から
 * インポートしやすいよう再エクスポートする。
 *
 * - vehicles / parts / part_movements: 既存（在庫車両・部品マスタ・入出庫）
 * - customer_vehicles / maintenance_*: 新規（顧客車両・整備）
 */
export {
  vehicles,
  parts,
  part_movements,
  customer_vehicles,
  maintenance_records,
  maintenance_line_items,
  maintenance_fees,
  maintenance_payments,
} from '@/lib/schema'
