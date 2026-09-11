import type { Metadata } from 'next'
import type { AppLocale } from '@/lib/i18n'
import type { ChannelInfo, ChannelPost } from '@/lib/types'
import { notFound } from 'next/navigation'
import { FeedList } from '@/components/feed/feed-list'
import { TelegramComments } from '@/components/feed/telegram-comments'
import { SubscribeCard } from '@/components/retention/subscribe-card'
import { JsonLd } from '@/components/site/json-ld'
import { PageFrame } from '@/components/site/page-frame'
import { buildStaticProxyUrl, getAppConfig } from '@/lib/config'
import { getLocaleMessages, localizePath } from '@/lib/i18n'
import { loadLongFormPost } from '@/lib/long-form'
import { calculateReadingTime } from '@/lib/reading-time'
import { resolveSeoImageUrl } from '@/lib/seo'
import { getStaticSnapshot } from '@/lib/telegram/static-snapshot'

export function resolvePostDynamicOgUrl(options: {
  siteUrl: string
  id: string
  title: string
  date?: string
  readingTime?: string
  channel?: string
  username?: string
  avatar?: string
  badge?: string
}): string {
  const { siteUrl, id, title, date, readingTime, channel, username, avatar, badge } = options
  const params = new URLSearchParams()
  if (id) params.set('id', id)
  if (title) params.set('title', title)
  if (date) params.set('date', date)
  if (readingTime) params.set('readingTime', readingTime)
  if (channel) params.set('channel', channel)
  if (username) params.set('username', username.replace(/^@/, ''))
  if (avatar) params.set('avatar', avatar)
  if (badge) params.set('badge', badge)
  if (siteUrl) params.set('site', siteUrl)

  const cleanSiteUrl = siteUrl.replace(/\/+$/, '')
  return `${cleanSiteUrl}/api/og?${params.toString()}`
}

export async function generatePostPageMetadata(locale: AppLocale, id: string): Promise<Metadata> {
  const messages = getLocaleMessages(locale)
  const config = getAppConfig()
  const { seo } = config
  const snapshot = await getStaticSnapshot()
  const post = snapshot.pages
    .flatMap(page => page.channel.posts)
    .find(item => item.id === id)

  const longForm = await loadLongFormPost(id)

  if (!post && !longForm)
    return {}

  const postTitle = longForm?.title || post?.title || post?.text?.slice(0, 80) || `Post ${id}`
  const postDescription = longForm?.text?.slice(0, 160) || post?.text?.slice(0, 160) || seo.description || messages.metadata.description
  const siteUrl = config.siteUrl || 'https://example.com'
  const postUrl = `${siteUrl}${localizePath(locale, `/posts/${id}`)}`
  const publishedTime = post?.datetime || longForm?.createdAt
  const dateStr = publishedTime
    ? new Date(publishedTime).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : ''
  const readingTime = calculateReadingTime(longForm?.text || post?.text || '')
  const channelTitle = snapshot.root?.title || config.channel
  const channelUsername = config.telegram || config.channel
  const avatarUrl = snapshot.root?.avatar
    ? (snapshot.root.avatar.startsWith('http') ? snapshot.root.avatar : `${siteUrl}${snapshot.root.avatar}`)
    : undefined

  const dynamicOgImage = resolvePostDynamicOgUrl({
    siteUrl,
    id,
    title: postTitle,
    date: dateStr,
    readingTime,
    channel: channelTitle,
    username: channelUsername,
    avatar: avatarUrl,
    badge: longForm ? 'Article' : 'Post',
  })

  return {
    title: postTitle,
    description: postDescription,
    openGraph: {
      type: 'article',
      title: postTitle,
      description: postDescription,
      url: postUrl,
      siteName: seo.title || messages.metadata.titleDefault,
      ...(publishedTime ? { publishedTime } : {}),
      ...(seo.author ? { authors: [seo.author] } : {}),
      images: [
        {
          url: dynamicOgImage,
          width: 1200,
          height: 630,
          alt: postTitle,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: postTitle,
      description: postDescription,
      images: [dynamicOgImage],
      ...(config.twitter ? { creator: `@${config.twitter}` } : {}),
    },
    alternates: {
      canonical: postUrl,
    },
  }
}

export async function renderPostPage(locale: AppLocale, id: string) {
  const messages = getLocaleMessages(locale)
  const config = getAppConfig()
  const snapshot = await getStaticSnapshot()
  const channelInfo = (snapshot.root || {}) as ChannelInfo
  const post = snapshot.pages
    .flatMap(page => page.channel.posts)
    .find(item => item.id === id) as ChannelPost | undefined

  const longForm = await loadLongFormPost(id)

  if (!post && !longForm) {
    notFound()
  }

  const siteUrl = config.siteUrl || 'https://example.com'

  const resolvedPost: ChannelPost = longForm
    ? {
        id,
        title: longForm.title || post?.title || `Post ${id}`,
        type: 'text',
        text: longForm.text,
        content: longForm.html,
        isLongForm: true,
        datetime: post?.datetime || longForm.createdAt || new Date().toISOString(),
        views: post?.views,
        comments: post?.comments,
        tags: post?.tags || [],
        reactions: post?.reactions || [],
      }
    : post!

  const channel: ChannelInfo = {
    ...channelInfo,
    posts: [resolvedPost],
  }
  const channelAvatar = channel.avatar?.startsWith('http')
    ? buildStaticProxyUrl(config.staticProxy, channel.avatar)
    : (channel.avatar || '/favicon.svg')
  const channelUsername = config.telegram || config.channel
  const { seo } = config
  const resolvedOgImage = resolvePostDynamicOgUrl({
    siteUrl,
    id,
    title: resolvedPost.title || `Post ${id}`,
    date: resolvedPost.datetime
      ? new Date(resolvedPost.datetime).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : '',
    readingTime: calculateReadingTime(resolvedPost.text || ''),
    channel: channel.title || config.channel,
    username: channelUsername,
    avatar: channelAvatar.startsWith('http') ? channelAvatar : `${siteUrl}${channelAvatar}`,
    badge: resolvedPost.isLongForm ? 'Article' : 'Post',
  })

  const blogPostingJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    'headline': resolvedPost.title || resolvedPost.text?.slice(0, 110) || `Post ${id}`,
    'datePublished': resolvedPost.datetime || undefined,
    'dateModified': resolvedPost.edited ? undefined : resolvedPost.datetime || undefined,
    'url': `${siteUrl}${localizePath(locale, `/posts/${id}`)}`,
    'author': {
      '@type': 'Person',
      'name': seo.author || 'Unknown',
    },
    'publisher': {
      '@type': 'Organization',
      'name': seo.title || 'Teleboros',
      ...(resolvedOgImage ? { logo: { '@type': 'ImageObject', 'url': resolvedOgImage } } : {}),
    },
    ...(resolvedOgImage ? { image: resolvedOgImage } : {}),
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': `${siteUrl}${localizePath(locale, `/posts/${id}`)}`,
    },
  }

  return (
    <PageFrame
      channel={channel}
      currentPath="/"
      locale={locale}
      messages={messages}
      currentLocalePath={`/posts/${id}`}
      showBack
    >
      <JsonLd data={blogPostingJsonLd} />
      <FeedList
        posts={channel.posts}
        locale={locale}
        timezone={config.timezone}
        channelName={config.channel}
        channelTitle={channel.title}
        channelUsername={channelUsername}
        channelAvatar={channelAvatar}
        showBefore={false}
        showAfter={false}
        uiLocale={locale}
        messages={messages}
      />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <SubscribeCard
          siteUrl={siteUrl}
          channelUsername={channelUsername}
          source={`post-${id}`}
        />
      </div>
      {config.comments?.enabled && config.comments?.websiteId && (
        <TelegramComments
          websiteId={config.comments.websiteId}
          pageId={resolvedPost.id}
          limit={config.comments.limit}
          color={config.comments.color}
        />
      )}
    </PageFrame>
  )
}
