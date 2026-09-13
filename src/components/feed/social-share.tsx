'use client'

import { useState } from 'react'
import { Check, Copy, Linkedin, Send, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export interface SocialShareProps {
  url: string
  title: string
}

export function SocialShare({ url, title }: SocialShareProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    catch {}
  }

  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  const shareLinks = [
    {
      name: 'Share on X',
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      icon: (
        <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      name: 'Share on Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      icon: <Send className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]" />,
    },
    {
      name: 'Share on LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: <Linkedin className="h-3.5 w-3.5 fill-current" />,
    },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2 py-4 my-6 border-y border-border/40">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mr-2">
        <Share2 className="h-3.5 w-3.5" />
        <span>Share article</span>
      </div>

      <TooltipProvider delayDuration={150}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {shareLinks.map(link => (
            <Tooltip key={link.name}>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground"
                >
                  <a href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.icon}
                    <span>{link.name.replace('Share on ', '')}</span>
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{link.name}</TooltipContent>
            </Tooltip>
          ))}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-8 gap-1.5 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{copied ? 'Link copied to clipboard!' : 'Copy article URL'}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  )
}
