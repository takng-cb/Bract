'use client'

/**
 * 表示タイムゾーンをクライアントコンポーネントへ供給する（REQ-0081）。
 * (crm)/layout.tsx でシステム設定の値を tz として渡す。
 * クライアント側の日時整形は useAppTimeZone() で取得した tz を fmt* に渡す。
 */
import { createContext, useContext } from 'react'
import { DEFAULT_TIMEZONE } from '@/lib/datetime'

const TimeZoneContext = createContext<string>(DEFAULT_TIMEZONE)

export function TimeZoneProvider({ tz, children }: { tz: string; children: React.ReactNode }) {
  return <TimeZoneContext value={tz}>{children}</TimeZoneContext>
}

export function useAppTimeZone(): string {
  return useContext(TimeZoneContext)
}
