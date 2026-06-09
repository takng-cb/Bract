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
  CalendarClock, CarFront, Phone, Mail, Calendar, FileText, MapPin, ShieldCheck,
  AlertTriangle, Handshake, Receipt, Wallet, Contact, Map, Scale, Printer,
  ArrowLeftRight, CheckCircle2, Globe, Lock, LogOut, MessageSquare, Pencil,
  CreditCard, Boxes, Paperclip, Eye, MousePointer2, Search, FlaskConical,
  Folder, Hash, Warehouse, Repeat, BookOpen, SlidersHorizontal,
} from 'lucide-react'

/** 絵文字 → Lucide コンポーネント（design_handoff/README.md「Icon Map」準拠） */
export const EMOJI_TO_LUCIDE: Record<string, LucideIcon> = {
  '⚙️': Settings,        // 設定
  '✅': SquareCheckBig,  // ToDo
  '🎫': Ticket,          // チケット/タグ
  '🏠': House,           // 物件 properties（家）
  '🏢': Building2,       // 取引先 accounts（ビル）
  '🏷️': Tag,             // タグ
  '👤': User,            // ユーザー/担当
  '👥': Users,           // 人物 contacts
  '💡': Lightbulb,       // ヒント
  '💰': Banknote,        // 売掛金/金額
  '💼': Briefcase,       // 経費/営業
  '📊': LayoutDashboard, // ダッシュボード
  '📋': ClipboardList,   // 整備パッケージ・案件など
  '🗓️': CalendarClock,   // 活動履歴 activities
  '📝': NotebookPen,     // メモ
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
  '🚙': CarFront,        // 顧客車両 customer-vehicles
  '🧑‍💼': UserRound,      // スタッフ staff
  '🪛': Cog,             // 部品 parts
  '📞': Phone,           // 電話番号
  '✉️': Mail,            // メール
  '📅': Calendar,        // 日付
  '📄': FileText,        // ファイル/書類
  '📍': MapPin,          // 位置/損傷マップ
  '🛡️': ShieldCheck,     // 管理者
  '⚠️': AlertTriangle,   // 警告/危険
  '🤝': Handshake,       // 商談/面談（活動種別）
  '🧾': Receipt,         // 領収/請求
  '💴': Wallet,          // 金額（円）
  '👔': Contact,         // 法人担当者（ビジネス連絡先）
  '🗺️': Map,             // 地図/土地登記
  '⚖️': Scale,           // 司法書士/法務
  '🖨': Printer,         // 印刷
  '🖨️': Printer,         // 印刷（VS付き）
  '🔀': ArrowLeftRight,  // 代理ログイン切替
  '☑️': CheckCircle2,    // 完了
  '🌐': Globe,           // システム全体/グローバル
  '🔒': Lock,            // セキュリティ
  '🚪': LogOut,          // ログアウト
  '💬': MessageSquare,   // Discord/チャット通知
  '✏️': Pencil,          // 編集
  '💳': CreditCard,      // 請求・支払
  '🧰': Boxes,           // 消耗品/工具
  '📎': Paperclip,       // 添付
  '👁': Eye,             // 表示/閲覧
  '👁️': Eye,             // 表示/閲覧（VS付き）
  '🖱️': MousePointer2,   // 操作ヒント
  '🔍': Search,          // 検索
  '🧪': FlaskConical,    // テスト
  '📁': Folder,          // フォルダ/ファイル
  '🔢': Hash,            // 数値/採番
  '🛡': ShieldCheck,     // 管理者（VSなし）
  '🏬': Warehouse,       // 倉庫 warehouses
  '🔁': Repeat,          // 在庫移動 stock-movements
  '📖': BookOpen,        // Wiki（社内ナレッジ）
  '🛠️': SlidersHorizontal, // システム設定
}

export function NavIcon({ icon, className = 'w-4 h-4' }: { icon?: string | null; className?: string }) {
  const Cmp = icon ? EMOJI_TO_LUCIDE[icon] : undefined
  if (Cmp) return <Cmp className={className} strokeWidth={2.25} aria-hidden />
  // 未マップは元の絵文字（段階移行のフォールバック）
  return <span className={className} aria-hidden>{icon}</span>
}
