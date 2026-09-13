'use client'

import { useEffect, useState } from 'react'
import { AlignLeft, ChevronDown, ChevronRight, List, X } from 'lucide-react'

export interface TocItem {
  id: string
  text: string
  level: number
}

interface TableOfContentsProps {
  headings?: TocItem[]
  isLongForm?: boolean
}

export function TableOfContents({ headings: propHeadings, isLongForm }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TocItem[]>(propHeadings || [])
  const [activeId, setActiveId] = useState<string>('')
  const [isInlineOpen, setIsInlineOpen] = useState(true)
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)

  // Fallback client-side extractor if server didn't pass headings
  useEffect(() => {
    if (propHeadings && propHeadings.length > 0) {
      setHeadings(propHeadings)
      return
    }

    const extractFromDom = () => {
      const proseEl = document.querySelector('.prose-telegram')
      if (!proseEl)
        return false

      const headingEls = proseEl.querySelectorAll('h2, h3, h4')
      if (headingEls.length < 2)
        return false

      const items: TocItem[] = []
      headingEls.forEach((el, index) => {
        let slug = el.id
        if (!slug) {
          slug = (el.textContent || '')
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .concat(`-${index}`)
          el.id = slug
        }

        const tag = el.tagName.toLowerCase()
        const level = tag === 'h4' ? 4 : tag === 'h3' ? 3 : 2

        items.push({
          id: slug,
          text: el.textContent || `Section ${index + 1}`,
          level,
        })
      })

      setHeadings(items)
      return true
    }

    if (!extractFromDom()) {
      const t1 = setTimeout(extractFromDom, 150)
      const t2 = setTimeout(extractFromDom, 500)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
  }, [propHeadings, isLongForm])

  // Setup scroll spy
  useEffect(() => {
    if (headings.length < 2)
      return

    const handleScrollSpy = () => {
      const headingElements = headings
        .map(h => document.getElementById(h.id))
        .filter((el): el is HTMLElement => el !== null)

      const scrollPos = window.scrollY + 100

      for (let i = headingElements.length - 1; i >= 0; i--) {
        const el = headingElements[i]
        if (el.offsetTop <= scrollPos) {
          setActiveId(headings[i].id)
          return
        }
      }

      if (headingElements.length > 0 && headingElements[0].offsetTop > scrollPos) {
        setActiveId(headings[0].id)
      }
    }

    window.addEventListener('scroll', handleScrollSpy, { passive: true })
    handleScrollSpy()

    return () => window.removeEventListener('scroll', handleScrollSpy)
  }, [headings])

  if (headings.length < 2)
    return null

  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    const target = document.getElementById(id)
    if (target) {
      const topOffset = 85
      const elementPosition = target.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - topOffset
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })
      window.history.pushState(null, '', `#${id}`)
      setActiveId(id)
      setIsMobileDrawerOpen(false)
    }
  }

  return (
    <>
      {/* 1. In-Page Collapsible Section for Small & Medium Screens (< xl) */}
      <div className="xl:hidden mx-auto max-w-2xl px-4 my-4">
        <div className="rounded-xl border bg-card/80 p-3.5 shadow-xs backdrop-blur-md transition-all">
          <button
            type="button"
            onClick={() => setIsInlineOpen(!isInlineOpen)}
            className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <List className="h-4 w-4 text-primary" />
              <span>Table of Contents</span>
              <span className="rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-normal text-muted-foreground">
                {headings.length} sections
              </span>
            </span>
            {isInlineOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          {isInlineOpen && (
            <nav className="mt-3 space-y-1 text-xs border-t pt-2.5 max-h-72 overflow-y-auto">
              {headings.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={e => handleScrollTo(e, item.id)}
                  className={`block truncate transition-colors py-1.5 px-2.5 rounded-md ${
                    item.level === 3 ? 'ml-3 text-muted-foreground/85' : item.level === 4 ? 'ml-5 text-muted-foreground/75' : 'font-medium'
                  } ${
                    activeId === item.id
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                  }`}
                  title={item.text}
                >
                  {item.text}
                </a>
              ))}
            </nav>
          )}
        </div>
      </div>

      {/* 2. Floating Quick-Access Trigger & Modal for Mobile/Tablets (< xl) */}
      <div className="xl:hidden fixed bottom-6 right-5 z-40">
        <button
          type="button"
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex items-center gap-2 rounded-full border border-primary/20 bg-background/95 px-3.5 py-2 text-xs font-semibold text-foreground shadow-lg backdrop-blur-md transition-all hover:bg-muted hover:scale-105 active:scale-95 cursor-pointer"
          title="Open Table of Contents"
        >
          <AlignLeft className="h-4 w-4 text-primary" />
          <span>Contents</span>
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono text-primary font-bold">
            {headings.length}
          </span>
        </button>
      </div>

      {isMobileDrawerOpen && (
        <div className="xl:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div className="relative z-10 max-h-[75vh] w-full rounded-t-2xl border-t bg-background p-5 shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between border-b pb-3 mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlignLeft className="h-4 w-4 text-primary" />
                <span>Table of Contents</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground font-normal">
                  {headings.length} sections
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="overflow-y-auto space-y-1.5 pr-1 py-1">
              {headings.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={e => handleScrollTo(e, item.id)}
                  className={`block truncate transition-colors py-2 px-3 rounded-lg text-sm ${
                    item.level === 3 ? 'ml-4 text-xs text-muted-foreground/85' : item.level === 4 ? 'ml-6 text-xs text-muted-foreground/75' : 'font-medium'
                  } ${
                    activeId === item.id
                      ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary'
                      : 'hover:bg-muted/60 text-foreground/80'
                  }`}
                >
                  {item.text}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* 3. Sticky Right-Rail Sidebar for Desktop Displays (>= xl) */}
      <aside
        aria-label="Table of contents"
        className="hidden xl:block fixed right-6 top-24 z-20 w-64 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border bg-card/80 p-4 shadow-sm backdrop-blur-md transition-all animate-in fade-in duration-300"
      >
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2">
          <AlignLeft className="h-3.5 w-3.5 text-primary" />
          <span>On This Page</span>
          <span className="ml-auto rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-normal text-muted-foreground">
            {headings.length}
          </span>
        </div>
        <nav className="space-y-1 text-xs">
          {headings.map(item => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={e => handleScrollTo(e, item.id)}
              className={`block truncate transition-all py-1 px-2 rounded-md ${
                item.level === 3 ? 'ml-2.5 text-muted-foreground/80' : item.level === 4 ? 'ml-4 text-muted-foreground/70' : 'font-medium'
              } ${
                activeId === item.id
                  ? 'bg-primary/10 text-primary font-semibold shadow-2xs'
                  : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
              }`}
              title={item.text}
            >
              {item.text}
            </a>
          ))}
        </nav>
      </aside>
    </>
  )
}
