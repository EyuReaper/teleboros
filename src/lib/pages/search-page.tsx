import type { AppLocale } from '@/lib/i18n'
import type { ChannelInfo } from '@/lib/types'
import { PageFrame } from '@/components/site/page-frame'
import { SearchResultsPanel } from '@/components/site/search-results-panel'
import { SearchTabs } from '@/components/site/search-tabs'
import { getAppConfig } from '@/lib/config'
import { getLocaleMessages } from '@/lib/i18n'
import { getStaticSnapshot } from '@/lib/telegram/static-snapshot'

interface SearchPageQuery {
  q?: string | string[]
}

export async function renderSearchPage(locale: AppLocale, searchParams: SearchPageQuery = {}) {
  const messages = getLocaleMessages(locale)
  const config = getAppConfig()
  const queryValue = Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q
  const currentLocalePath = queryValue
    ? `/search?q=${encodeURIComponent(queryValue)}`
    : '/search'
  const snapshot = await getStaticSnapshot()
  const channel = snapshot.root as ChannelInfo

  return (
    <PageFrame
      channel={channel}
      currentPath="/search"
      locale={locale}
      messages={messages}
      currentLocalePath={currentLocalePath}
      showBack
    >
      {config.semanticSearch.enabled
        ? <SearchTabs locale={locale} messages={messages} />
        : <SearchResultsPanel locale={locale} messages={messages} />}
    </PageFrame>
  )
}
