'use client'

import { useEffect, useRef } from 'react'

export interface TelegramCommentsProps {
  websiteId: string
  pageId?: string
  limit?: number
  color?: string
}

export function TelegramComments({ websiteId, pageId, limit = 5, color = 'E22F38' }: TelegramCommentsProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current)
      return
    if (!websiteId)
      return

    // Clear previous widget if it exists (e.g., during dev hot reload)
    containerRef.current.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://comments.app/js/widget.js?3'
    script.async = true
    script.setAttribute('data-comments-app-website', websiteId)
    if (pageId) {
      script.setAttribute('data-page-id', pageId)
    }
    script.setAttribute('data-limit', limit.toString())
    script.setAttribute('data-color', color)

    containerRef.current.appendChild(script)

    return () => {
      // Cleanup on unmount
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [websiteId, pageId, limit, color])

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
