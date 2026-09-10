'use client'

import { AlertCircle, Check, Loader2, Mail, Radio, Sparkles } from 'lucide-react'
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FeedModal } from './feed-modal'
import { PushNotificationButton } from './push-notification-button'

interface SubscribeCardProps {
  siteUrl: string
  channelUsername?: string
  className?: string
  source?: string
}

export function SubscribeCard({
  siteUrl,
  channelUsername,
  className = '',
  source = 'website',
}: SubscribeCardProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [feedModalOpen, setFeedModalOpen] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      return
    }

    setLoading(true)
    setStatus(null)

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to subscribe')
      }

      setStatus({
        type: 'success',
        message: data.message || 'You are subscribed to new updates!',
      })
      setEmail('')
    }
    catch (err: any) {
      setStatus({
        type: 'error',
        message: err.message || 'Something went wrong. Please try again.',
      })
    }
    finally {
      setLoading(false)
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-card to-card/50 p-5 sm:p-6 shadow-sm ${className}`}>
      {/* Decorative background glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-36 w-36 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-500">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Stay in the Loop</span>
        </div>

        <h3 className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">
          Subscribe to Updates
        </h3>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Get notified whenever fresh articles, technical deep dives, and announcements are published. No spam, ever.
        </p>

        {status && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-lg p-2.5 text-xs font-medium ${
              status.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-destructive/10 text-destructive'
            }`}
          >
            {status.type === 'success' ? (
              <Check className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{status.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="Enter your email address..."
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
              className="pl-9 h-10 text-sm bg-background/80"
            />
          </div>
          <Button type="submit" disabled={loading} className="h-10 px-5 text-xs sm:text-sm font-semibold shrink-0">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Subscribing...
              </>
            ) : (
              'Subscribe'
            )}
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setFeedModalOpen(true)}
            >
              <Radio className="h-3.5 w-3.5 text-orange-500" />
              <span>RSS & JSON Feeds</span>
            </Button>
          </div>

          <PushNotificationButton className="h-7 px-2 text-xs gap-1.5" />
        </div>
      </div>

      <FeedModal
        siteUrl={siteUrl}
        channelUsername={channelUsername}
        open={feedModalOpen}
        onOpenChange={setFeedModalOpen}
      />
    </div>
  )
}
