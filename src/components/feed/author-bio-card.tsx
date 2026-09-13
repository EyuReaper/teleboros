import Image from 'next/image'
import { Github, Globe, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface AuthorBioCardProps {
  channelTitle: string
  channelUsername: string
  avatar: string
  description?: string
  twitter?: string
  github?: string
  website?: string
  subscriberCount?: string
}

export function AuthorBioCard({
  channelTitle,
  channelUsername,
  avatar,
  description,
  twitter,
  github,
  website,
  subscriberCount,
}: AuthorBioCardProps) {
  const telegramHref = channelUsername ? `https://t.me/${channelUsername.replace(/^@/, '')}` : ''

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-5 my-8 backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Image
          src={avatar}
          alt={channelTitle}
          width={56}
          height={56}
          className="h-14 w-14 rounded-full border border-border/80 object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold leading-none">{channelTitle}</h3>
            {subscriberCount ? (
              <span className="text-xs text-muted-foreground">
                ({subscriberCount} subscribers)
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {description.replace(/<[^>]*>/g, '')}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
          {telegramHref ? (
            <Button asChild size="sm" className="h-8 gap-1.5 rounded-full px-3 text-xs">
              <a href={telegramHref} target="_blank" rel="noopener noreferrer">
                <Send className="h-3 w-3" />
                <span>Join Channel</span>
              </a>
            </Button>
          ) : null}
          {twitter ? (
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground">
              <a href={`https://twitter.com/${twitter.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </Button>
          ) : null}
          {github ? (
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground">
              <a href={`https://github.com/${github.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <Github className="h-3.5 w-3.5" />
              </a>
            </Button>
          ) : null}
          {website ? (
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground">
              <a href={website} target="_blank" rel="noopener noreferrer" aria-label="Website">
                <Globe className="h-3.5 w-3.5" />
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
