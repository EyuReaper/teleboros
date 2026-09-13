'use client'

import { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'

export interface GiscusCommentsProps {
  repo: string
  repoId: string
  category: string
  categoryId: string
  mapping?: string
  term?: string
}

export function GiscusComments({
  repo,
  repoId,
  category,
  categoryId,
  mapping = 'pathname',
  term,
}: GiscusCommentsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    if (!containerRef.current || !repo || !repoId) {
      return
    }

    containerRef.current.innerHTML = ''

    const isDark = resolvedTheme === 'dark'
    const script = document.createElement('script')
    script.src = 'https://giscus.app/client.js'
    script.async = true
    script.crossOrigin = 'anonymous'

    script.setAttribute('data-repo', repo)
    script.setAttribute('data-repo-id', repoId)
    script.setAttribute('data-category', category)
    script.setAttribute('data-category-id', categoryId)
    script.setAttribute('data-mapping', mapping)
    if (term) {
      script.setAttribute('data-term', term)
    }
    script.setAttribute('data-strict', '0')
    script.setAttribute('data-reactions-enabled', '1')
    script.setAttribute('data-emit-metadata', '0')
    script.setAttribute('data-input-position', 'top')
    script.setAttribute('data-theme', isDark ? 'dark_dimmed' : 'light')
    script.setAttribute('data-lang', 'en')
    script.setAttribute('data-loading', 'lazy')

    containerRef.current.appendChild(script)

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [repo, repoId, category, categoryId, mapping, term, resolvedTheme])

  if (!repo || !repoId) {
    return null
  }

  return (
    <div className="w-full mt-8 border-t border-border/40 pt-8">
      <div ref={containerRef} className="w-full min-h-[150px] giscus" />
    </div>
  )
}
