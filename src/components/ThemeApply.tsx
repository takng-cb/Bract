'use client'

/**
 * クロスデバイスのテーマ追従（REQ-0079）。
 * DB に保存されたユーザー設定を「真実」として、別デバイス／cookie 消失時に
 * <html> と cookie を DB 値へ合わせる。同一デバイスでは layout のインライン
 * スクリプトが cookie から先に適用済みのため、ここは差分があるときだけ働く。
 */
import { useEffect } from 'react'
import { applyTheme, writeThemeCookie, serializeTheme, type ThemeMode } from '@/lib/theme'

export default function ThemeApply({ color, mode }: { color: string; mode: ThemeMode }) {
  useEffect(() => {
    const want = serializeTheme(color, mode)
    const m = document.cookie.match(/(?:^|; )bract_theme=([^;]+)/)
    const have = m ? decodeURIComponent(m[1]) : ''
    if (have !== want) {
      writeThemeCookie(color, mode)
      applyTheme(color, mode)
    }
    // mode === 'system' のとき OS のライト/ダーク切替に追従
    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const onChange = () => applyTheme(color, 'system')
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
  }, [color, mode])

  return null
}
