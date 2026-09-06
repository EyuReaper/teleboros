'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface CollapsibleDescriptionProps {
  descriptionHTML: string
  label?: string
}

export function CollapsibleDescription({
  descriptionHTML,
  label = 'DESCRIPTION',
}: CollapsibleDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = contentRef.current
    if (el) {
      setIsOverflowing(el.scrollHeight > 52)
    }
  }, [descriptionHTML])

  // Automatically collapse when the user scrolls down into the feed
  useEffect(() => {
    if (!isExpanded) {
      return
    }

    const handleScroll = () => {
      if (window.scrollY > 120) {
        setIsExpanded(false)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isExpanded])

  if (!descriptionHTML) {
    return null
  }

  return (
    <div className="border-b px-4 py-3 transition-all duration-300">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
          {label}
        </p>
        {isOverflowing && (
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={isExpanded}
          >
            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
            {isExpanded
              ? (
                  <ChevronUp className="h-3 w-3" />
                )
              : (
                  <ChevronDown className="h-3 w-3" />
                )}
          </button>
        )}
      </div>
      <div className="relative">
        <div
          ref={contentRef}
          className={cn(
            'prose-telegram text-sm transition-[max-height] duration-300 ease-in-out',
            isExpanded
              ? 'max-h-80 overflow-y-auto'
              : 'max-h-12 overflow-hidden',
          )}
          data-twemoji-scope
          dangerouslySetInnerHTML={{ __html: descriptionHTML }}
        />
        {!isExpanded && isOverflowing && (
          <div
            onClick={() => setIsExpanded(true)}
            className="absolute inset-x-0 bottom-0 h-6 cursor-pointer bg-gradient-to-t from-background to-transparent"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )
}
