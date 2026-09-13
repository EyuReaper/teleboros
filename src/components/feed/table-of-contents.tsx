'use client'

import { useEffect, useState } from 'react'
import { AlignLeft, ChevronDown, ChevronRight } from 'lucide-react'

interface TocItem {
  id: string
  text: string
  level: number
}

interface TableOfContentsProps {
  isLongForm?: boolean
}

export function TableOfContents({ isLongForm }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  useEffect(() => {
    const extractHeadings = () => {
      const proseEl = document.querySelector('.prose-telegram')
      if (!proseEl)
        return false

      const headingEls = proseEl.querySelectorAll('h2, h3, h4')
      if (headingEls.length < 2) {
        return false
      }

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

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setActiveId(entry.target.id)
            }
          }
        },
        { rootMargin: '-80px 0px -40% 0px' },
      )

      headingEls.forEach(el => observer.observe(el))
      return true
    }

    // Try immediately
    if (!extractHeadings()) {
      // Fallback timer if prose hasn't hydrated or rendered yet
      const t1 = setTimeout(extractHeadings, 100)
      const t2 = setTimeout(extractHeadings, 350)
      const t3 = setTimeout(extractHeadings, 800)

      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
        clearTimeout(t3)
      }
    }
  }, [isLongForm])

  if (headings.length < 2)
    return null

  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    const target = document.getElementById(id)
    if (target) {
      const topOffset = 80
      const elementPosition = target.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - topOffset
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })
      window.history.pushState(null, '', `#${id}`)
      setActiveId(id)
      setIsMobileOpen(false)
    }
  }

  return (
    <>
      {/* Mobile & Tablet & Tiled Window Collapsible Dropdown (< xl) */}
      <div className="xl:hidden mx-auto max-w-2xl px-4 my-3">
        <div className="rounded-xl border bg-card/70 p-3 backdrop-blur-md shadow-xs transition-all">
          <button
            type="button"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <AlignLeft className="h-3.5 w-3.5 text-primary" />
              <span>Table of Contents</span>
              <span className="rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-normal text-muted-foreground">
                {headings.length}
              </span>
            </span>
            {isMobileOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          {isMobileOpen && (
            <nav className="mt-2.5 space-y-1 text-xs border-t pt-2 max-h-60 overflow-y-auto">
              {headings.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={e => handleScroll(e, item.id)}
                  className={`block truncate transition-all py-1.5 px-2 rounded-md ${
                    item.level === 3 ? 'ml-3 text-muted-foreground/80' : item.level === 4 ? 'ml-5 text-muted-foreground/70' : 'font-medium'
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

      {/* Desktop Sticky Right-Rail Sidebar (>= xl) */}
      <aside
        aria-label="Table of contents"
        className="hidden xl:block fixed right-6 top-24 z-20 w-60 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border bg-card/80 p-4 shadow-sm backdrop-blur-md transition-all animate-in fade-in duration-300"
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
              onClick={e => handleScroll(e, item.id)}
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
