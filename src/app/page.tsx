import type { ChannelInfo } from '@/lib/types'
import { FeedList } from '@/components/feed/feed-list'
import { InfiniteFeed } from '@/components/feed/infinite-feed'
import { PageFrame } from '@/components/site/page-frame'
import { buildStaticProxyUrl, getAppConfig } from '@/lib/config'
import { DEFAULT_LOCALE, getLocaleMessages } from '@/lib/i18n'
import { getSnapshotPaginationLinks } from '@/lib/pagination/snapshot-pagination'
import { getStaticSnapshot } from '@/lib/telegram/static-snapshot'

export const dynamic = 'force-static'

export default async function RootPage() {
  const locale = DEFAULT_LOCALE
  const messages = getLocaleMessages(locale)
  const config = getAppConfig()
  const snapshot = await getStaticSnapshot()
  const channel = snapshot.root as ChannelInfo
  const { olderHref } = getSnapshotPaginationLinks(snapshot.pages, 0, locale)
  const channelAvatar = channel.avatar?.startsWith('http')
    ? buildStaticProxyUrl(config.staticProxy, channel.avatar)
    : (channel.avatar || '/favicon.svg')
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
      {config.infiniteScroll.enabled
        ? <InfiniteFeed initialPosts={channel.posts} {...feedProps} />
        : <FeedList posts={channel.posts} {...feedProps} />}
    </PageFrame>
  )
}
