'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'

export interface TelegramCommentsProps {
  websiteId: string
  pageId?: string
  limit?: number
  color?: string
}

export function TelegramComments({ websiteId, pageId, limit = 5, color = 'E22F38' }: TelegramCommentsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!containerRef.current)
      return
    if (!websiteId)
      return
    if (!mounted)
      return

    // Clear previous widget if it exists (e.g., during theme switch or hot reload)
    containerRef.current.innerHTML = ''

    const isDark = resolvedTheme === 'dark'
    const script = document.createElement('script')
    script.src = 'https://comments.app/js/widget.js?3'
    script.async = true
    script.setAttribute('data-comments-app-website', websiteId)
    if (pageId) {
      script.setAttribute('data-page-id', pageId)
    }
    script.setAttribute('data-limit', limit.toString())
    script.setAttribute('data-color', color)
    script.setAttribute('data-dark', isDark ? '1' : '0')

    containerRef.current.appendChild(script)

    return () => {
      // Cleanup on unmount or theme switch
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [websiteId, pageId, limit, color, resolvedTheme, mounted])

  if (!websiteId)
    return null

  return (
    <div className="w-full mt-8 border-t border-border/40 pt-8">
      <div ref={containerRef} className="w-full min-h-[150px] flex items-center justify-center telegram-comments-container">
        <style dangerouslySetInnerHTML={{ __html: `
          .telegram-comments-container iframe {
            margin: 0 auto !important;
            width: 100% !important;
          }
        ` }}
        />
      </div>
    </div>
  )
}
