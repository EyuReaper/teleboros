'use client'

import { useEffect, useState } from 'react'
import { AlignLeft } from 'lucide-react'

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

  useEffect(() => {
    if (!isLongForm)
      return

    // Small delay to ensure prose HTML is in DOM
    const timer = setTimeout(() => {
      const proseEl = document.querySelector('.prose-telegram')
      if (!proseEl)
        return

      const headingEls = proseEl.querySelectorAll('h2, h3')
      if (headingEls.length < 2) {
        setHeadings([])
        return
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

        items.push({
          id: slug,
          text: el.textContent || `Section ${index + 1}`,
          level: el.tagName.toLowerCase() === 'h3' ? 3 : 2,
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
    }, 100)

    return () => clearTimeout(timer)
  }, [isLongForm])

  if (!isLongForm || headings.length < 2)
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
    }
  }

  return (
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
              item.level === 3 ? 'ml-2.5 text-muted-foreground/80' : 'font-medium'
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
  )
}
