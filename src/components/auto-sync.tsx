'use client'

import { useEffect } from 'react'

export function AutoSync() {
  useEffect(() => {
    fetch('/api/sync', { method: 'POST' }).catch(() => {})
  }, [])

  return null
}
