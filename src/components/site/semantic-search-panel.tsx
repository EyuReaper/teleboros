'use client'

import type { FormEvent } from 'react'
import type { AppLocale } from '@/lib/i18n'
import type { LocaleMessages } from '@/locales/en'
import { Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { localizePath } from '@/lib/i18n'

interface SemanticSearchResult {
  id: string
  title: string
  datetime: string
  snippet: string
  similarity: number
}

interface SemanticSearchResponse {
  query?: string
  results?: SemanticSearchResult[]
  error?: string
}

function formatDatetime(value: string, locale: AppLocale) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

interface SemanticSearchPanelProps {
  locale: AppLocale
  messages: LocaleMessages
}

export function SemanticSearchPanel({ locale, messages }: SemanticSearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SemanticSearchResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function runSearch() {
    const trimmedQuery = query.trim()
    if (!trimmedQuery || loading) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: trimmedQuery }),
      })

      const payload = await response.json().catch(() => ({})) as SemanticSearchResponse

      if (!response.ok) {
        setError(payload.error || messages.searchPanel.notConfigured)
        setResults(null)
        return
      }

      setResults(Array.isArray(payload.results) ? payload.results : [])
    }
    catch {
      setError(messages.searchPanel.notConfigured)
      setResults(null)
    }
    finally {
      setLoading(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void runSearch()
  }

  return (
    <>
      <div className="mb-1 px-4 py-3 text-sm uppercase tracking-[0.16em] text-muted-foreground">
        {messages.searchPanel.headingSemantic}
      </div>

      <form onSubmit={handleSubmit} className="px-4 pb-4">
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={messages.searchPanel.askPlaceholder}
            aria-label={messages.searchPanel.askPlaceholder}
            className="h-10 min-w-0 flex-1 rounded-xl border border-border/80 bg-muted/20 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-background"
          />
          <Button type="submit" size="default" disabled={loading || !query.trim()}>
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Sparkles className="h-4 w-4" />}
            {messages.searchPanel.askButton}
          </Button>
        </div>
      </form>

      {loading
        ? (
            <div className="px-4 pb-6 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {messages.searchPanel.loadingSemantic}
              </span>
            </div>
          )
        : error
          ? (
              <div className="px-4 pb-6 text-sm text-destructive">{error}</div>
            )
          : results && results.length === 0
            ? (
                <div className="px-4 pb-6 text-sm text-muted-foreground">{messages.searchPanel.noSemanticResults}</div>
              )
            : results
              ? (
                  <div className="border-b">
                    {results.map(result => (
                      <article key={result.id} className="border-b px-4 py-4">
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <a
                            href={localizePath(locale, `/posts/${result.id}`)}
                            className="link-smooth text-sm font-semibold text-foreground"
                          >
                            {result.title || `${messages.searchPanel.defaultPostTitlePrefix} ${result.id}`}
                          </a>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatDatetime(result.datetime, locale)}</span>
                        </div>

                        {result.snippet
                          ? (
                              <p className="line-clamp-3 text-sm text-muted-foreground">{result.snippet}</p>
                            )
                          : null}

                        <div className="mt-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground/80">
                          {Math.round(result.similarity * 100)}
                          %
                          {' '}
                          {messages.searchPanel.similarityLabel}
                        </div>
                      </article>
                    ))}
                  </div>
                )
              : (
                  <div className="px-4 pb-6 text-sm text-muted-foreground">{messages.searchPanel.askHint}</div>
                )}
    </>
  )
}
