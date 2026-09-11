'use client'

import { Check, Copy, ExternalLink, Radio, Rss, Send } from 'lucide-react'
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface FeedModalProps {
  siteUrl: string
  channelUsername?: string
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function FeedModal({
  siteUrl,
  channelUsername,
  trigger,
  open,
  onOpenChange,
}: FeedModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const normalizedSiteUrl = siteUrl.replace(/\/+$/, '')
  const rssUrl = `${normalizedSiteUrl}/rss.xml`
  const jsonFeedUrl = `${normalizedSiteUrl}/feed.json`
  const telegramUrl = channelUsername ? `https://t.me/${channelUsername.replace(/^@/, '')}` : ''

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    }
    catch (err) {
      console.warn('Failed to copy to clipboard:', err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Radio className="h-5 w-5 text-sky-500" />
            Discover Feeds & Updates
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Follow our posts using your favorite RSS reader, JSON feed aggregator, or directly on Telegram.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* RSS 2.0 Feed */}
          <div className="rounded-xl border bg-muted/30 p-4 transition-colors hover:bg-muted/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                  <Rss className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">RSS 2.0 Feed</h4>
                  <p className="font-mono text-xs text-muted-foreground truncate max-w-[220px] sm:max-w-xs">
                    {rssUrl}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 h-8 text-xs gap-1.5"
                onClick={() => copyToClipboard(rssUrl, 'rss')}
              >
                {copiedKey === 'rss'
                  ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        Copied
                      </>
                    )
                  : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
              <span>Open in:</span>
              <a
                href={`https://feedly.com/i/subscription/feed/${encodeURIComponent(rssUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
              >
                Feedly
                {' '}
                <ExternalLink className="h-3 w-3" />
              </a>
              <span>·</span>
              <a
                href={`https://www.inoreader.com/?add_feed=${encodeURIComponent(rssUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
              >
                Inoreader
                {' '}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* JSON Feed 1.1 */}
          <div className="rounded-xl border bg-muted/30 p-4 transition-colors hover:bg-muted/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Radio className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">JSON Feed 1.1</h4>
                  <p className="font-mono text-xs text-muted-foreground truncate max-w-[220px] sm:max-w-xs">
                    {jsonFeedUrl}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 h-8 text-xs gap-1.5"
                onClick={() => copyToClipboard(jsonFeedUrl, 'json')}
              >
                {copiedKey === 'json'
                  ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        Copied
                      </>
                    )
                  : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
              </Button>
            </div>
          </div>

          {/* Telegram Channel Link */}
          {telegramUrl && (
            <div className="rounded-xl border bg-muted/30 p-4 transition-colors hover:bg-muted/50">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
                    <Send className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Telegram Channel</h4>
                    <p className="text-xs text-muted-foreground">
                      Real-time instant broadcasts on Telegram
                    </p>
                  </div>
                </div>
                <Button asChild size="sm" className="shrink-0 h-8 text-xs gap-1.5">
                  <a href={telegramUrl} target="_blank" rel="noopener noreferrer">
                    Join
                    {' '}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
