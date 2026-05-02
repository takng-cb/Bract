'use client'

import { useState } from 'react'

export default function RecordId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={copy}
      title="クリックしてコピー"
      className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 font-mono transition-colors"
    >
      <span className="text-zinc-300">ID:</span>
      <span>{id}</span>
      <span className="text-zinc-300 hover:text-zinc-500">
        {copied ? '✓' : '⧉'}
      </span>
    </button>
  )
}
