'use client'

import type { AppLocale } from '@/lib/i18n'
import type { ChannelPost } from '@/lib/types'
import type { LocaleMessages } from '@/locales/en'
import { ChevronLeft, ChevronRight, Eye, MessageCircle, Pin, Tag } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Image from 'next/image'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { localizePath } from '@/lib/i18n'
import { formatPostTimestamp } from '@/lib/time'
import { cn } from '@/lib/utils'
import { AnimatedMetricNumber } from './animated-metric-number'

interface PinnedPostsProps {
  posts: ChannelPost[]
  locale: string
  timezone: string
  channelTitle?: string
  channelUsername?: string
  channelAvatar?: string
  channelName?: string
  uiLocale: AppLocale
  messages: LocaleMessages
}

export function PinnedPosts({
  posts,
  locale,
  timezone,
  channelTitle = '',
  channelUsername = '',
  channelAvatar = '',
  channelName = '',
  uiLocale,
  messages,
}: PinnedPostsProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  if (!posts || posts.length === 0) {
    return null
  }

  const activeIndex = Math.min(currentIndex, posts.length - 1)
  const currentPost = posts[activeIndex]

  // Adaptive image-color theme resolution
  const accentRgb = currentPost.accentColor?.trim()
  const hasCustomColor = Boolean(accentRgb && accentRgb.includes(','))

  const cardCustomStyle = hasCustomColor
    ? ({
        '--pin-accent': `rgb(${accentRgb})`,
        '--pin-bg': `rgba(${accentRgb}, 0.06)`,
        '--pin-border': `rgba(${accentRgb}, 0.35)`,
        '--pin-glow': `rgba(${accentRgb}, 0.16)`,
        '--pin-badge-bg': `rgba(${accentRgb}, 0.16)`,
        '--pin-badge-text': `rgb(${accentRgb})`,
      } as React.CSSProperties)
    : undefined

  const displayName = channelTitle.trim() || channelName
  const username = (channelUsername || channelName).replace(/^@/, '').trim()
  const avatarSrc = channelAvatar?.trim() || '/logo.png'
  const avatarAlt = displayName
    ? `${displayName}${messages.feed.avatarSuffix}`
    : messages.feed.channelAvatarAlt

  const formattedTime = formatPostTimestamp(currentPost.datetime, locale, timezone)

  const handlePrev = () => {
    setCurrentIndex(prev => (prev === 0 ? posts.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setCurrentIndex(prev => (prev === posts.length - 1 ? 0 : prev + 1))
  }

  return (
    <section
      aria-label="Pinned Posts"
      className="border-b bg-gradient-to-b from-background/40 to-muted/20 px-4 py-4"
      style={cardCustomStyle}
    >
      <div
        className={cn(
          'relative rounded-xl border p-4 sm:p-5 transition-all duration-300',
          'border-[var(--pin-border,hsl(var(--primary)/0.25))]',
          'bg-[var(--pin-bg,hsl(var(--primary)/0.03))]',
          'shadow-[0_4px_24px_-6px_var(--pin-glow,transparent)]',
        )}
      >
        {/* Header Bar: Badge + Multi-pin Controls */}
        <div className="mb-3.5 flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
          <div
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider',
              'bg-[var(--pin-badge-bg,hsl(var(--primary)/0.12))]',
              'text-[var(--pin-badge-text,hsl(var(--primary)))]',
            )}
          >
            <Pin className="h-3.5 w-3.5 fill-current rotate-45" />
            <span>
              {posts.length > 1
                ? `Pinned (${activeIndex + 1} of ${posts.length})`
                : 'Pinned Post'}
            </span>
          </div>

          {posts.length > 1 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {posts.map((post, idx) => (
                  <button
                    key={`pin-dot-${post.id}`}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`Go to pinned post ${idx + 1}`}
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-300',
                      idx === activeIndex
                        ? 'w-4 bg-[var(--pin-accent,hsl(var(--primary)))]'
                        : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60',
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={handlePrev}
                  className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
                  aria-label="Previous pinned post"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={handleNext}
                  className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
                  aria-label="Next pinned post"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Post Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPost.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            data-twemoji-scope
          >
            <div className="flex items-stretch gap-3">
              <div className="relative w-11 shrink-0">
                <Image
                  src={avatarSrc}
                  alt={avatarAlt}
                  width={44}
                  height={44}
                  className="relative z-[1] h-11 w-11 rounded-full border object-cover"
                  loading="eager"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                  {displayName && (
                    <span className="truncate font-semibold text-foreground">{displayName}</span>
                  )}
                  {username && (
                    <span className="truncate text-muted-foreground">
                      {`@${username}`}
                    </span>
                  )}
                  {(displayName || username) && (
                    <span className="text-muted-foreground">·</span>
                  )}
                  <a
                    href={localizePath(uiLocale, `/posts/${currentPost.id}`)}
                    className="link-smooth text-muted-foreground"
                  >
                    <time dateTime={currentPost.datetime} title={currentPost.datetime}>
                      {formattedTime || currentPost.datetime}
                    </time>
                  </a>
                </div>

                {currentPost.content && (
                  <div
                    className="prose-telegram"
                    dangerouslySetInnerHTML={{ __html: currentPost.content }}
                  />
                )}

                {currentPost.tags && currentPost.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    {currentPost.tags.map(tag => (
                      <a
                        key={`${currentPost.id}-${tag}`}
                        href={localizePath(uiLocale, `/search?q=${encodeURIComponent(`#${tag}`)}`)}
                      >
                        <Badge variant="outline" className="cursor-pointer rounded-full px-3 hover:bg-secondary">
                          {tag}
                        </Badge>
                      </a>
                    ))}
                  </div>
                )}

                {currentPost.isLongForm && (
                  <div className="mt-3">
                    <a
                      href={localizePath(uiLocale, `/posts/${currentPost.id}`)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-opacity hover:opacity-80"
                    >
                      <span>Read full article</span>
                      <span aria-hidden="true">&rarr;</span>
                    </a>
                  </div>
                )}

                <div
                  className="mt-3 flex flex-wrap items-center justify-end gap-2"
                  aria-label={messages.feed.reactionsAndViewsAria}
                >
                  {currentPost.reactions && currentPost.reactions.map(reaction => (
                    <span
                      key={`${currentPost.id}-${reaction.emojiId || reaction.emoji}-${reaction.count}`}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-semibold ${
                        reaction.isPaid
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {reaction.emojiImage
                        ? (
                            <Image
                              src={reaction.emojiImage}
                              alt={reaction.emoji || messages.feed.emojiAlt}
                              width={14}
                              height={14}
                              className="h-3.5 w-3.5"
                              loading="lazy"
                            />
                          )
                        : (
                            <span>{reaction.emoji || '⭐'}</span>
                          )}
                      <AnimatedMetricNumber value={reaction.count} />
                    </span>
                  ))}

                  {currentPost.views && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-0.5 text-xs text-muted-foreground"
                      title={messages.feed.viewCountTitle}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <AnimatedMetricNumber value={currentPost.views} />
                    </span>
                  )}

                  {currentPost.comments && (
                    <a
                      href={localizePath(uiLocale, `/posts/${currentPost.id}`)}
                      className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      title="Comments"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <AnimatedMetricNumber value={currentPost.comments} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
