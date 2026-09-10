'use client'

import { Rss } from 'lucide-react'
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { FeedModal } from './feed-modal'

interface FeedButtonProps {
  siteUrl: string
  channelUsername?: string
  label?: string
  className?: string
  iconClassName?: string
}

export function FeedButton({
  siteUrl,
  channelUsername,
  label = 'Feeds & RSS',
  className,
  iconClassName,
}: FeedButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={className}
            onClick={() => setOpen(true)}
            aria-label={label}
          >
            <Rss className={cn(iconClassName, 'fill-none')} />
            <span className="sr-only">{label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>

      <FeedModal
        siteUrl={siteUrl}
        channelUsername={channelUsername}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
