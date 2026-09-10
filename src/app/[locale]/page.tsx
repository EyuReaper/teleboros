import type { ChannelInfo } from '@/lib/types'
import { FeedList } from '@/components/feed/feed-list'
import { InfiniteFeed } from '@/components/feed/infinite-feed'
import { PinnedPosts } from '@/components/feed/pinned-posts'
import { SubscribeCard } from '@/components/retention/subscribe-card'
import { PageFrame } from '@/components/site/page-frame'
import { buildStaticProxyUrl, getAppConfig } from '@/lib/config'
import { getLocaleMessages, normalizeAppLocale } from '@/lib/i18n'
import { getImageMetaMap } from '@/lib/image-meta'
import { getSnapshotPaginationLinks } from '@/lib/pagination/snapshot-pagination'
import { enrichPostsWithAccentColors, resolvePinnedPosts } from '@/lib/pinned-posts'
import { getStaticSnapshot } from '@/lib/telegram/static-snapshot'

export const dynamic = 'force-static'

interface HomePageProps {
  params: Promise<{
    locale: string
  }>
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale: localeParam } = (await params) ?? {}
  const locale = normalizeAppLocale(localeParam)
  const messages = getLocaleMessages(locale)
  const config = getAppConfig()
  const snapshot = await getStaticSnapshot()
  const channel = snapshot.root as ChannelInfo

  const imageMetaMap = await getImageMetaMap()
  enrichPostsWithAccentColors(channel.posts, imageMetaMap)
  const { pinned, unpinned } = resolvePinnedPosts(channel.posts, config.pinnedPostIds)

  const { olderHref } = getSnapshotPaginationLinks(snapshot.pages, 0, locale)
  const channelAvatar = channel.avatar?.startsWith('http')
    ? buildStaticProxyUrl(config.staticProxy, channel.avatar)
    : (channel.avatar || '/logo.png')
  const channelUsername = config.telegram || config.channel

  const feedProps = {
    locale,
    timezone: config.timezone,
    channelName: config.channel,
    channelTitle: channel.title,
    channelUsername,
    channelAvatar,
    olderHref,
    newerHref: null,
    uiLocale: locale,
    messages,
  }

  return (
    <PageFrame channel={channel} currentPath="/" locale={locale} messages={messages} currentLocalePath="/" pageNumber={1}>
      {pinned.length > 0 && (
        <PinnedPosts posts={pinned} {...feedProps} />
      )}
      <div className="mx-auto max-w-2xl px-4 py-4">
        <SubscribeCard
          siteUrl={config.siteUrl || 'https://example.com'}
          channelUsername={channelUsername}
          source="home-feed"
        />
      </div>
      {config.infiniteScroll.enabled
        ? <InfiniteFeed initialPosts={unpinned} {...feedProps} />
        : <FeedList posts={unpinned} {...feedProps} />}
    </PageFrame>
  )
}
