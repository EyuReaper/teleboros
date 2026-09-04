'use client'

import type { AppLocale } from '@/lib/i18n'
import type { LocaleMessages } from '@/locales/en'
import { useState } from 'react'
import { SearchResultsPanel } from '@/components/site/search-results-panel'
import { SemanticSearchPanel } from '@/components/site/semantic-search-panel'
import { cn } from '@/lib/utils'

type SearchMode = 'keyword' | 'semantic'

interface SearchTabsProps {
  locale: AppLocale
  messages: LocaleMessages
}

export function SearchTabs({ locale, messages }: SearchTabsProps) {
  const [mode, setMode] = useState<SearchMode>('keyword')

  return (
    <div>
      <div className="flex items-end gap-5 border-b px-4 pt-2">
        <button
          type="button"
          onClick={() => setMode('keyword')}
          className={cn(
            '-mb-px border-b-2 pb-2 text-sm font-medium transition-colors',
            mode === 'keyword'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {messages.searchPanel.modeKeyword}
        </button>
        <button
          type="button"
          onClick={() => setMode('semantic')}
          className={cn(
            '-mb-px border-b-2 pb-2 text-sm font-medium transition-colors',
            mode === 'semantic'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {messages.searchPanel.modeSemantic}
        </button>
      </div>

      {mode === 'keyword'
        ? <SearchResultsPanel locale={locale} messages={messages} />
        : <SemanticSearchPanel locale={locale} messages={messages} />}
    </div>
  )
}
