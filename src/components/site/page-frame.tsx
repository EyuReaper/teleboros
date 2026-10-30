'use client'

import type { ReactNode } from 'react'
import type { AppLocale } from '@/lib/i18n'
import type { ChannelInfo } from '@/lib/types'
import type { LocaleMessages } from '@/locales/en'
import { useCallback, useEffect, useState } from 'react'
import { Github, House, Languages, Menu, PanelLeftClose, PanelLeftOpen, Pencil, Send, Tag, X } from 'lucide-react'
import Image from 'next/image'
import { FeedButton } from '@/components/retention/feed-button'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemCheck,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { buildStaticProxyUrl, getAppConfig } from '@/lib/config'
import { getLocaleMessages, localizePath, normalizeAppLocale, SUPPORTED_LOCALES } from '@/lib/i18n'
import { renderInlineMarkdown } from '@/lib/sanitize'
import { cn } from '@/lib/utils'
import packageJson from '../../../package.json'
import { CollapsibleDescription } from './collapsible-description'
import { CommandPalette } from './command-palette'
import { ContentAlbum } from './content-album'
import { ContentAlbumLightbox } from './content-album-lightbox'
import { ContentAudioPlayer } from './content-audio-player'
import { ContentCodeCopy } from './content-code-copy'
import { ContentMermaid } from './content-mermaid'
import { ContentTwemoji } from './content-twemoji'
import { ContentVideoPlayer } from './content-video-player'
import { ScrollToTop } from './scroll-to-top'
import { SidebarBackButton } from './sidebar-back-button'
import { ThemeToggle } from './theme-toggle'

interface PageFrameProps {
  channel: ChannelInfo
  currentPath: string
  children: ReactNode
  locale?: AppLocale
  messages?: LocaleMessages
  currentLocalePath?: string
  pageNumber?: number
  showBack?: boolean
  wide?: boolean
}

function getPageTitle(currentPath: string, messages: LocaleMessages, pageNumber?: number) {
  if (currentPath === '/tags') {
    return messages.pageTitle.tags
  }

  if (currentPath === '/search') {
    return messages.pageTitle.search
  }

  if (pageNumber && pageNumber > 1) {
    return `${messages.pageTitle.page} ${pageNumber}`
  }

  return messages.pageTitle.home
}

function getTelegramChannelHref(
  telegramHost: string,
  telegramValue: string,
  channelValue: string,
) {
  const raw = (telegramValue || channelValue || '').trim()
  if (!raw) {
    return ''
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw
  }

  const host = (telegramHost || 't.me').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '')
  const handle = raw.replace(/^@/, '')
  return `https://${host}/${handle}`
}

export function PageFrame({
  channel,
  currentPath,
  children,
  locale,
  messages,
  currentLocalePath,
  pageNumber,
  showBack,
  wide,
}: PageFrameProps) {
  const config = getAppConfig()
  const resolvedLocale = locale || normalizeAppLocale(config.locale)
  const resolvedMessages = messages || getLocaleMessages(resolvedLocale)
  const activePathForLocaleSwitch = currentLocalePath || currentPath
  const githubRepoHref = 'https://github.com/andatoshiki/teleboros'
  const githubRepoTitle = `${resolvedMessages.external.github} teleboros`

  const avatar = channel.avatar?.startsWith('http')
    ? buildStaticProxyUrl(config.staticProxy, channel.avatar)
    : (channel.avatar || '/teleboros(white)icon.jpg')
  const telegramChannelHref = getTelegramChannelHref(config.telegramHost, config.telegram, config.channel)

  const navItems = [
    { title: resolvedMessages.nav.home, href: '/', enabled: true },
    { title: resolvedMessages.nav.tags, href: '/tags', enabled: true },
  ]
  const enabledNavItems = navItems.filter(item => item.enabled)
  const internalCommandItems = [
    { title: resolvedMessages.external.rss, href: '/rss.xml' },
    { title: githubRepoTitle, href: githubRepoHref },
    telegramChannelHref
      ? { title: `${resolvedMessages.external.telegram} ${(config.telegram || config.channel).trim()}`.trim(), href: telegramChannelHref }
      : null,
  ].filter((item): item is { title: string, href: string } => Boolean(item))
  const customCommandItems = [
    config.website
      ? { title: resolvedMessages.external.website, href: config.website }
      : null,
    config.twitter
      ? { title: `${resolvedMessages.external.twitter} @${config.twitter}`, href: `https://twitter.com/${config.twitter}` }
      : null,
    config.mastodon
      ? { title: `${resolvedMessages.external.mastodon} @${config.mastodon.split('@').pop()}`, href: `https://${config.mastodon}` }
      : null,
    config.bluesky
      ? { title: `${resolvedMessages.external.bluesky} @${config.bluesky}`, href: `https://bsky.app/profile/${config.bluesky}` }
      : null,
  ].filter((item): item is { title: string, href: string } => Boolean(item))
  const localeMenuLabels: Record<AppLocale, string> = {
    en: 'English',
    ja: '日本语',
    am: 'አማርኛ',
  }
  const sidebarIconButtonClass = 'h-11 w-11 sm:h-12 sm:w-12 p-0 shrink-0 rounded-full bg-transparent text-muted-foreground transition-colors duration-200 hover:bg-muted/70 hover:text-foreground focus-visible:bg-muted/70 data-[state=open]:bg-muted/70 data-[state=open]:text-foreground data-[state=open]:[&_svg]:fill-current'
  const sidebarIconGlyphClass = 'h-[22px] w-[22px] sm:h-6 sm:w-6 stroke-current stroke-[1.9] transition-[fill] duration-200'
  const sidebarIconActiveClass = 'bg-muted/70 text-foreground'
  const isHomeActive = currentPath === '/'
  const isTagsActive = currentPath === '/tags'
  const isComposeActive = currentPath === '/compose'
  const bannerMarkdownHtml = renderInlineMarkdown(config.customBanner)
  const footerMarkdownHtml = renderInlineMarkdown(config.customFooter)

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem('teleboros_sidebar_collapsed')
      if (saved === 'true') {
        setIsSidebarCollapsed(true)
      }
    }
    catch {}
  }, [])

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('teleboros_sidebar_collapsed', String(next))
      }
      catch {}
      return next
    })
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {bannerMarkdownHtml
        ? (
            <div className="border-b bg-muted/30 px-4 py-2 text-center text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere] [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-foreground [&_code]:rounded [&_code]:bg-background [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_strong]:font-semibold">
              <div dangerouslySetInnerHTML={{ __html: bannerMarkdownHtml }} />
            </div>
          )
        : null}

      <div className={cn(
        'mx-auto grid md:border-r transition-[grid-template-columns] duration-300',
        isSidebarCollapsed ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-[64px_minmax(0,1fr)] lg:grid-cols-[72px_minmax(0,1fr)]',
        wide ? 'max-w-6xl' : 'max-w-[784px]',
      )}>
        <aside className={cn(
          'sticky top-0 z-10 h-screen border-r bg-background/95 transition-all duration-300',
          isSidebarCollapsed ? 'hidden w-0 overflow-hidden border-r-0' : 'hidden md:block',
        )}>
          <TooltipProvider delayDuration={150}>
            <div className="flex h-full w-full flex-col items-center gap-1.5 px-1 py-3 sm:gap-2 sm:px-2 sm:py-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={localizePath(resolvedLocale, '/')}
                    aria-label="Teleboros"
                    className="mb-1 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full transition-transform duration-200 hover:scale-105"
                  >
                    <Image
                      src="/teleboros(white)icon.jpg"
                      alt="Teleboros"
                      width={36}
                      height={36}
                      className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover"
                      priority
                    />
                    <span className="sr-only">Teleboros</span>
                  </a>
                </TooltipTrigger>
                <TooltipContent side="right">Teleboros</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    onClick={toggleSidebar}
                    className={sidebarIconButtonClass}
                    aria-label="Collapse sidebar"
                  >
                    <PanelLeftClose className={sidebarIconGlyphClass} />
                    <span className="sr-only">Collapse sidebar</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Collapse sidebar</TooltipContent>
              </Tooltip>
              {showBack
                ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <SidebarBackButton
                            label={resolvedMessages.post.backToFeed}
                            buttonClassName={sidebarIconButtonClass}
                            iconClassName={sidebarIconGlyphClass}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right">{resolvedMessages.post.backToFeed}</TooltipContent>
                    </Tooltip>
                  )
                : null}
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={localizePath(resolvedLocale, '/')}
                    aria-label={resolvedMessages.nav.home}
                    className={cn(
                      'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      sidebarIconButtonClass,
                      isHomeActive && sidebarIconActiveClass,
                    )}
                  >
                    <House className={cn(sidebarIconGlyphClass, isHomeActive ? 'fill-current' : 'fill-none')} />
                    <span className="sr-only">{resolvedMessages.nav.home}</span>
                  </a>
                </TooltipTrigger>
                <TooltipContent side="right">{resolvedMessages.nav.home}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={localizePath(resolvedLocale, '/tags')}
                    aria-label={resolvedMessages.nav.tags}
                    className={cn(
                      'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      sidebarIconButtonClass,
                      isTagsActive && sidebarIconActiveClass,
                    )}
                  >
                    <Tag className={cn(sidebarIconGlyphClass, isTagsActive ? 'fill-current' : 'fill-none')} />
                    <span className="sr-only">{resolvedMessages.nav.tags}</span>
                  </a>
                </TooltipTrigger>
                <TooltipContent side="right">{resolvedMessages.nav.tags}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={localizePath(resolvedLocale, '/compose')}
                    aria-label="Compose"
                    className={cn(
                      'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      sidebarIconButtonClass,
                      isComposeActive && sidebarIconActiveClass,
                    )}
                  >
                    <Pencil className={cn(sidebarIconGlyphClass, isComposeActive ? 'fill-current' : 'fill-none')} />
                    <span className="sr-only">Compose</span>
                  </a>
                </TooltipTrigger>
                <TooltipContent side="right">Compose</TooltipContent>
              </Tooltip>
              <FeedButton
                siteUrl={config.siteUrl || 'https://example.com'}
                channelUsername={config.telegram || config.channel}
                label={resolvedMessages.external.rss}
                className={sidebarIconButtonClass}
                iconClassName={sidebarIconGlyphClass}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="ghost"
                    className={sidebarIconButtonClass}
                  >
                    <a
                      href={githubRepoHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={githubRepoTitle}
                    >
                      <Github className={cn(sidebarIconGlyphClass, 'fill-none')} />
                      <span className="sr-only">{githubRepoTitle}</span>
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{githubRepoTitle}</TooltipContent>
              </Tooltip>
              {telegramChannelHref
                ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          asChild
                          variant="ghost"
                          className={sidebarIconButtonClass}
                        >
                          <a
                            href={telegramChannelHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={resolvedMessages.external.telegram}
                          >
                            <Send className={cn(sidebarIconGlyphClass, 'fill-none')} />
                            <span className="sr-only">{resolvedMessages.external.telegram}</span>
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">{resolvedMessages.external.telegram}</TooltipContent>
                    </Tooltip>
                  )
                : null}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <CommandPalette
                      navItems={enabledNavItems}
                      internalNavItems={internalCommandItems}
                      customNavItems={customCommandItems}
                      locale={resolvedLocale}
                      messages={resolvedMessages}
                      triggerMode="icon"
                      triggerClassName={sidebarIconButtonClass}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <span className="flex items-center gap-1.5">
                    {resolvedMessages.nav.search}
                    <kbd className="rounded border border-primary-foreground/25 bg-primary-foreground/10 px-1 py-0.5 font-mono text-[10px] leading-none">⌘ K</kbd>
                  </span>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <DropdownMenu>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className={sidebarIconButtonClass}
                        aria-label={resolvedMessages.sidebar.language}
                      >
                        <Languages className={cn(sidebarIconGlyphClass, 'fill-none')} />
                        <span className="sr-only">{resolvedMessages.sidebar.language}</span>
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <DropdownMenuContent side="right" align="start" className="w-44">
                    {SUPPORTED_LOCALES.map(targetLocale => (
                      <DropdownMenuItem key={`locale-switch-${targetLocale}`} asChild>
                        <a
                          href={localizePath(targetLocale, activePathForLocaleSwitch)}
                          className="flex w-full items-center gap-2"
                        >
                          <span>{localeMenuLabels[targetLocale]}</span>
                          <DropdownMenuItemCheck visible={targetLocale === resolvedLocale} />
                        </a>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <TooltipContent side="right">{resolvedMessages.sidebar.language}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <ThemeToggle
                      ariaLabel={resolvedMessages.theme.toggle}
                      className={`${sidebarIconButtonClass} [&_svg]:h-[22px] [&_svg]:w-[22px] sm:[&_svg]:h-6 sm:[&_svg]:w-6 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.9]`}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">{resolvedMessages.theme.toggle}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ScrollToTop
                    ariaLabel={resolvedMessages.sidebar.backToTop}
                    className={sidebarIconButtonClass}
                  />
                </TooltipTrigger>
                <TooltipContent side="right">{resolvedMessages.sidebar.backToTop}</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </aside>

        <main className="min-w-0">
          <div className="sticky top-0 z-[5] border-b bg-background/95 px-3.5 sm:px-4 py-2.5 sm:py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <div className="flex items-center justify-between gap-2.5 sm:gap-3">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                {/* Mobile Navigation: Back button on detail pages, Menu drawer button on top-level views */}
                {showBack ? (
                  <SidebarBackButton
                    label={resolvedMessages.post.backToFeed}
                    buttonClassName="md:hidden h-10 w-10 shrink-0 rounded-full p-0 flex items-center justify-center text-muted-foreground hover:bg-muted/70 hover:text-foreground touch-manipulation"
                    iconClassName="h-5 w-5"
                  />
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="md:hidden h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:bg-muted/70 hover:text-foreground touch-manipulation"
                    aria-label="Open navigation menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                )}

                {isSidebarCollapsed && (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={toggleSidebar}
                          className="hidden md:flex h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                          aria-label="Expand sidebar"
                        >
                          <PanelLeftOpen className="h-5 w-5" />
                          <span className="sr-only">Expand sidebar</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Expand sidebar</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <a href={localizePath(resolvedLocale, '/')} className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                  <Image
                    src={avatar}
                    alt={channel.title}
                    width={40}
                    height={40}
                    className="h-9 w-9 sm:h-11 sm:w-11 rounded-full border object-cover shrink-0"
                    loading="eager"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm sm:text-base font-semibold leading-tight">{channel.title}</p>
                    {channel.subscriberCount
                      ? (
                          <p className="truncate text-[11px] sm:text-xs text-muted-foreground">
                            {channel.subscriberCount}
                            {' '}
                            {resolvedMessages.feed.subscribers}
                          </p>
                        )
                      : null}
                  </div>
                </a>
              </div>
              <p className="shrink-0 text-xs sm:text-sm font-medium text-muted-foreground max-w-[110px] sm:max-w-none truncate text-right">
                {getPageTitle(currentPath, resolvedMessages, pageNumber)}
              </p>
            </div>
          </div>

          {/* Mobile Navigation Drawer Sheet (for discoverable labeled navigation) */}
          {isMobileMenuOpen && (
            <div className="md:hidden fixed inset-0 z-50 flex">
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <div className="relative z-10 w-[290px] max-w-[85vw] h-full bg-background border-r p-5 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-left duration-300 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
                <div className="space-y-6">
                  {/* Branding & Close Button */}
                  <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Image
                        src="/teleboros(white)icon.jpg"
                        alt="Teleboros"
                        width={36}
                        height={36}
                        className="h-9 w-9 rounded-full object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="font-semibold text-sm block truncate leading-tight">Teleboros</span>
                        <span className="text-[11px] text-muted-foreground block truncate">v{packageJson.version}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground touch-manipulation"
                      aria-label="Close navigation menu"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>

                  {/* Labeled Primary Navigation */}
                  <nav className="space-y-1">
                    <a
                      href={localizePath(resolvedLocale, '/')}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px]',
                        isHomeActive
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <House className="h-5 w-5 shrink-0" />
                      <span>{resolvedMessages.nav.home}</span>
                    </a>

                    <a
                      href={localizePath(resolvedLocale, '/tags')}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px]',
                        isTagsActive
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Tag className="h-5 w-5 shrink-0" />
                      <span>{resolvedMessages.nav.tags}</span>
                    </a>

                    <a
                      href="/compose"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px]',
                        isComposeActive
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Pencil className="h-5 w-5 shrink-0" />
                      <span>Compose</span>
                    </a>

                    <div className="pt-2">
                      <CommandPalette
                        navItems={enabledNavItems}
                        internalNavItems={internalCommandItems}
                        customNavItems={customCommandItems}
                        locale={resolvedLocale}
                        messages={resolvedMessages}
                        triggerMode="full"
                      />
                    </div>
                  </nav>

                  {/* Settings & Language Options */}
                  <div className="space-y-3 pt-3 border-t">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">Settings</p>

                    <div className="space-y-1">
                      {SUPPORTED_LOCALES.map(targetLocale => (
                        <a
                          key={`mobile-locale-${targetLocale}`}
                          href={localizePath(targetLocale, activePathForLocaleSwitch)}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={cn(
                            'flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-medium min-h-[38px] transition-colors',
                            targetLocale === resolvedLocale
                              ? 'bg-muted text-foreground font-semibold'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <Languages className="h-3.5 w-3.5 opacity-70" />
                            <span>{localeMenuLabels[targetLocale]}</span>
                          </span>
                          {targetLocale === resolvedLocale && (
                            <span className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </a>
                      ))}
                    </div>

                    <div className="flex items-center justify-between px-3.5 py-2.5 border rounded-xl bg-card">
                      <span className="text-xs font-medium text-muted-foreground">{resolvedMessages.theme.toggle}</span>
                      <ThemeToggle
                        ariaLabel={resolvedMessages.theme.toggle}
                        className="h-9 w-9 rounded-full bg-muted/60"
                      />
                    </div>
                  </div>
                </div>

                {/* External Social / RSS Actions */}
                <div className="pt-4 border-t space-y-2">
                  {telegramChannelHref ? (
                    <a
                      href={telegramChannelHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground min-h-[38px] transition-colors"
                    >
                      <Send className="h-4 w-4 text-sky-500 shrink-0" />
                      <span className="truncate">{resolvedMessages.external.telegram}</span>
                    </a>
                  ) : null}
                  <FeedButton
                    siteUrl={config.siteUrl || 'https://example.com'}
                    channelUsername={config.telegram || config.channel}
                    label={resolvedMessages.external.rss}
                    className="w-full justify-start text-xs text-muted-foreground h-9 px-3"
                  />
                </div>
              </div>
            </div>
          )}
          {config.hideDescription
            ? null
            : (
                <CollapsibleDescription descriptionHTML={channel.descriptionHTML} />
              )}
          <ContentAlbumLightbox />
          <ContentAlbum />
          <ContentCodeCopy copyLabel={resolvedMessages.codeCopy.copyCode} copiedLabel={resolvedMessages.codeCopy.copied} />
          <ContentMermaid />
          <ContentTwemoji />
          <ContentVideoPlayer />
          <ContentAudioPlayer />
          <div>{children}</div>
        </main>

        {footerMarkdownHtml
          ? (
              <footer className={cn("border-t px-4 py-5 text-center text-xs leading-relaxed text-muted-foreground", !isSidebarCollapsed && "md:col-start-2")}>
                <div className="[overflow-wrap:anywhere] [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_strong]:font-semibold" dangerouslySetInnerHTML={{ __html: footerMarkdownHtml }} />
              </footer>
            )
          : (
              <footer className={cn("border-t px-4 py-5 text-center text-xs leading-relaxed text-muted-foreground", !isSidebarCollapsed && "md:col-start-2")}>
                <p>
                  Built with love by
                  {' '}
                  <a href="https://github.com/EyuReaper" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 transition-colors hover:text-foreground">EyuReaper</a>
                  .
                </p>
                <p className="mt-1.5">
                  <span className="font-mono text-[10px]">
                    v
                    {packageJson.version}
                  </span>
                  {' · Powered by '}
                  <a href="https://nextjs.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 transition-colors hover:text-foreground">Next.js</a>
                  {', '}
                  <a href="https://react.dev" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 transition-colors hover:text-foreground">React</a>
                  {', '}
                  <a href="https://tailwindcss.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 transition-colors hover:text-foreground">Tailwind CSS</a>
                  {', '}
                  <a href="https://ui.shadcn.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 transition-colors hover:text-foreground">shadcn/ui</a>
                  {' & '}
                  <a href="https://www.radix-ui.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 transition-colors hover:text-foreground">Radix UI</a>
                  .
                </p>
              </footer>
            )}
      </div>
    </div>
  )
}
