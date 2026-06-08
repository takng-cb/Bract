/**
 * ナビ用アイコン：既存の絵文字文字列を Lucide アイコンへ写像する（REQ-0020 / Icon Map）
 *
 * NavItem.icon などに保存された絵文字をそのまま受け取り、対応する Lucide を描画する。
 * 未マップの絵文字はフォールバックで元の絵文字を表示する（段階移行のため）。
 * stroke-width はハンドオフ指定の 2.25。
 */
import type { LucideIcon } from 'lucide-react'
import {
  Settings, SquareCheckBig, Ticket, Building2, House, Tag, User, Users, Lightbulb,
  Banknote, Briefcase, LayoutDashboard, ClipboardList, NotebookPen, Inbox, Bell,
  Link2, Library, Bot, Puzzle, Sparkles, Package, Wrench, Car, UserRound, Cog,
} from 'lucide-react'

/** 絵文字 → Lucide コンポーネント（design_handoff/README.md「Icon Map」準拠） */
export const EMOJI_TO_LUCIDE: Record<string, LucideIcon> = {
  '⚙️': Settings,        // 設定
  '✅': SquareCheckBig,  // ToDo
  '🎫': Ticket,          // チケット/タグ
  '🏠': Building2,       // 取引先 accounts
  '🏢': House,           // 物件 properties
  '🏷️': Tag,             // タグ
  '👤': User,            // ユーザー/担当
  '👥': Users,           // 人物 contacts
  '💡': Lightbulb,       // ヒント
  '💰': Banknote,        // 売掛金/金額
  '💼': Briefcase,       // 経費/営業
  '📊': LayoutDashboard, // ダッシュボード
  '📋': ClipboardList,   // 案件 assignments
  '📝': NotebookPen,     // 活動/メモ
  '📥': Inbox,           // 取り込み
  '🔔': Bell,            // 通知
  '🔗': Link2,           // 関係/リンク
  '🗂️': Library,         // ブック/オブジェクト定義
  '🤖': Bot,             // AI
  '🧩': Puzzle,          // モジュール
  '✨': Sparkles,        // AI/クイック
  '📦': Package,         // モジュール既定/箱
  '🔧': Wrench,          // 整備 maintenance
  '🚗': Car,             // 車両 vehicles
  '🧑‍💼': UserRound,      // スタッフ staff
  '🪛': Cog,             // 部品 parts
}

export function NavIcon({ icon, className = 'w-4 h-4' }: { icon?: string | null; className?: string }) {
  const Cmp = icon ? EMOJI_TO_LUCIDE[icon] : undefined
  if (Cmp) return <Cmp className={className} strokeWidth={2.25} aria-hidden />
  // 未マップは元の絵文字（段階移行のフォールバック）
  return <span className={className} aria-hidden>{icon}</span>
}
