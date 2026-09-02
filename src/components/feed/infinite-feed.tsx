'use client'

import type { AppLocale } from '@/lib/i18n'
import type { ChannelPost } from '@/lib/types'
import type { LocaleMessages } from '@/locales/en'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { localizePath } from '@/lib/i18n'
import { AnimatedFeedContainer } from './animated-feed'
import { PostCard } from './post-card'

interface FeedPage {
  cursor: string
  posts: ChannelPost[]
}

interface FeedIndexPayload {
  generatedAt?: string
  pages: FeedPage[]
}

interface InfiniteFeedProps {
  initialPosts: ChannelPost[]
  locale: string
  timezone: string
  channelName: string
  channelTitle?: string
  channelUsername?: string
  channelAvatar?: string
  olderHref?: string | null
  newerHref?: string | null
  uiLocale: AppLocale
  messages: LocaleMessages
}

export function InfiniteFeed({
  initialPosts,
  locale,
  timezone,
  channelName,
  channelTitle,
  channelUsername,
  channelAvatar,
  olderHref,
  uiLocale,
  messages,
}: InfiniteFeedProps) {
  const [pageIndex, setPageIndex] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const allPagesRef = useRef<FeedPage[]>([])
  const loadedRef = useRef(false)

  const visiblePosts = useMemo(() => {
    if (allPagesRef.current.length === 0) {
      return initialPosts
    }
    return allPagesRef.current
      .slice(0, pageIndex + 1)
      .flatMap(page => page.posts)
  }, [initialPosts, pageIndex])

  const beforeCursor = visiblePosts[visiblePosts.length - 1]?.id
  const resolvedOlderHref = olderHref === undefined
    ? ((beforeCursor && Number(beforeCursor) > 1) ? localizePath(uiLocale, `/before/${beforeCursor}`) : null)
    : olderHref

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) {
      return
    }

    setLoading(true)
    try {
      if (!loadedRef.current) {
        const response = await fetch('/feed/feed.json', { cache: 'force-cache' })
        if (!response.ok) {
          throw new Error(`Failed to fetch feed: ${response.status}`)
        }
        const payload = await response.json() as FeedIndexPayload
        const allPages = Array.isArray(payload.pages) ? payload.pages : []
        allPagesRef.current = allPages
        loadedRef.current = true

        if (allPages.length === 0) {
          setHasMore(false)
          return
        }
      }

      const allPages = allPagesRef.current
      setPageIndex((current) => {
        const next = current + 1
        if (next >= allPages.length) {
          setHasMore(false)
          return current
        }
        return next
      })
    }
    catch (indexError) {
      console.error('[infinite-feed] Unable to load feed pagination data', indexError)
      setHasMore(false)
    }
    finally {
      setLoading(false)
    }
  }, [loading, hasMore])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore()
        }
      },
      { rootMargin: '600px 0px', threshold: 0 },
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [loadMore])

  return (
    <AnimatedFeedContainer className={hasMore ? undefined : '[&>article:last-child]:border-b-0'}>
      {visiblePosts.map((post, index) => (
        <PostCard
          key={post.id}
          post={post}
          index={index}
          locale={locale}
          timezone={timezone}
          channelTitle={channelTitle}
          channelUsername={channelUsername}
          channelAvatar={channelAvatar}
          channelName={channelName}
          uiLocale={uiLocale}
          messages={messages}
        />
      ))}

      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center px-4 py-6">
          {loading && (
            <span className="text-sm text-muted-foreground">{messages.feed.loading}</span>
          )}
        </div>
      )}

      {!hasMore && resolvedOlderHref && (
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <Button asChild variant="outline" className="rounded-full">
            <a href={resolvedOlderHref}>
              <ArrowLeft className="h-4 w-4" />
              {messages.feed.older}
            </a>
          </Button>
        </div>
      )}
    </AnimatedFeedContainer>
  )
}
