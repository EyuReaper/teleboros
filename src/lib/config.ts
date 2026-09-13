import type { AnalyticsConfig, CloudFlareConfig, CommentsConfig, InfiniteScrollConfig, SemanticSearchConfig, SeoConfig } from './constant'
import { SITE_CONSTANTS } from './constant'

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i

export interface AppConfig {
  channel: string
  locale: string
  timezone: string
  siteUrl: string
  staticProxy: string
  cloudFlare: CloudFlareConfig
  telegramHost: string
  hideDescription: boolean
  reactionsEnabled: boolean
  pwa: boolean
  website: string
  twitter: string
  github: string
  telegram: string
  mastodon: string
  bluesky: string
  customBanner: string
  customFooter: string
  rssBeautify: boolean
  seo: SeoConfig
  analytics: AnalyticsConfig
  comments: CommentsConfig
  infiniteScroll: InfiniteScrollConfig
  semanticSearch: SemanticSearchConfig
  pinnedPostIds?: string[]
}

export function buildStaticProxyUrl(staticProxy: string, rawUrl: string) {
  const input = rawUrl.trim()
  if (!input || !staticProxy) {
    return input
  }

  if (input.startsWith(staticProxy)) {
    return input
  }

  const normalizedProxy = staticProxy.endsWith('/') ? staticProxy : `${staticProxy}/`

  let target = input
  if (target.startsWith('//')) {
    target = `https:${target}`
  }

  if (normalizedProxy.startsWith('/')) {
    return `${normalizedProxy}${encodeURIComponent(target)}`
  }

  if (target.startsWith('/')) {
    target = target.slice(1)
  }

  return `${normalizedProxy}${target}`
}

function normalizeStaticProxy(value: string) {
  const normalized = value.trim()
  if (!normalized) {
    return ''
  }

  if (ABSOLUTE_URL_PATTERN.test(normalized) || normalized.startsWith('/')) {
    return normalized
  }

  return ''
}

export function getAppConfig(): AppConfig {
  const channel = (process.env.TELEGRAM_CHANNEL || process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL || SITE_CONSTANTS.channel || '').trim().replace(/^@/, '')
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || SITE_CONSTANTS.siteUrl || '').replace(/\/+$/, '')
  const author = (process.env.AUTHOR_NAME || process.env.NEXT_PUBLIC_AUTHOR_NAME || SITE_CONSTANTS.seo.author || '').trim()
  const twitter = (process.env.TWITTER_HANDLE || process.env.TWITTER || SITE_CONSTANTS.twitter || '').replace(/^@/, '').trim()
  const github = (process.env.GITHUB_HANDLE || process.env.GITHUB || SITE_CONSTANTS.github || '').replace(/^@/, '').trim()
  const commentsWebsiteId = (process.env.COMMENTS_WEBSITE_ID || process.env.NEXT_PUBLIC_COMMENTS_WEBSITE_ID || SITE_CONSTANTS.comments.websiteId || '').trim()

  return {
    channel: channel || SITE_CONSTANTS.channel,
    locale: process.env.DEFAULT_LOCALE || SITE_CONSTANTS.locale,
    timezone: process.env.TIMEZONE || SITE_CONSTANTS.timezone,
    siteUrl,
    staticProxy: normalizeStaticProxy(process.env.STATIC_PROXY || SITE_CONSTANTS.staticProxy),
    cloudFlare: SITE_CONSTANTS.cloudFlare,
    telegramHost: process.env.TELEGRAM_HOST || SITE_CONSTANTS.telegramHost,
    hideDescription: SITE_CONSTANTS.hideDescription,
    reactionsEnabled: SITE_CONSTANTS.reactionsEnabled,
    pwa: SITE_CONSTANTS.pwa,
    website: process.env.WEBSITE_URL || SITE_CONSTANTS.website,
    twitter,
    github,
    telegram: channel || SITE_CONSTANTS.telegram,
    mastodon: process.env.MASTODON_HANDLE || SITE_CONSTANTS.mastodon,
    bluesky: process.env.BLUESKY_HANDLE || SITE_CONSTANTS.bluesky,
    customBanner: SITE_CONSTANTS.customBanner,
    customFooter: SITE_CONSTANTS.customFooter,
    rssBeautify: SITE_CONSTANTS.rssBeautify,
    seo: {
      ...SITE_CONSTANTS.seo,
      author: author || SITE_CONSTANTS.seo.author,
      title: process.env.SITE_TITLE || (author ? `Teleboros – ${author}` : SITE_CONSTANTS.seo.title),
    },
    analytics: SITE_CONSTANTS.analytics,
    comments: {
      ...SITE_CONSTANTS.comments,
      websiteId: commentsWebsiteId,
      enabled: commentsWebsiteId ? true : SITE_CONSTANTS.comments.enabled,
      giscus: {
        enabled: Boolean(process.env.GISCUS_REPO && process.env.GISCUS_REPO_ID),
        repo: process.env.GISCUS_REPO || '',
        repoId: process.env.GISCUS_REPO_ID || '',
        category: process.env.GISCUS_CATEGORY || 'General',
        categoryId: process.env.GISCUS_CATEGORY_ID || '',
        mapping: process.env.GISCUS_MAPPING || 'pathname',
      },
    },
    infiniteScroll: SITE_CONSTANTS.infiniteScroll,
    semanticSearch: SITE_CONSTANTS.semanticSearch,
    pinnedPostIds: SITE_CONSTANTS.pinnedPostIds,
  }
}
