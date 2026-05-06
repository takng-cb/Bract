'use client'

import React from 'react'

type Props = {
  children: React.ReactNode
  fallback?: React.ReactNode
}

type State = {
  hasError: boolean
  error: Error | null
}

/**
 * PC テーブルビュー（GroupedTable）のクラッシュをキャッチし、
 * モバイルカード表示に影響を与えないようにするエラーバウンダリ。
 */
export default class TableErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[TableErrorBoundary] テーブル表示でエラーが発生しました:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-600">
            テーブルの表示中にエラーが発生しました。ページを再読み込みしてください。
          </div>
        )
      )
    }
    return this.props.children
  }
}
