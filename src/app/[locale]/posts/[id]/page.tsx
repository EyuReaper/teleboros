import type { Metadata } from 'next'
import { NON_DEFAULT_LOCALES, normalizeAppLocale } from '@/lib/i18n'
import { generatePostPageMetadata, renderPostPage } from '@/lib/pages/post-page'
import { getStaticSnapshot } from '@/lib/telegram/static-snapshot'

export const dynamic = 'auto'
export const dynamicParams = true
export const revalidate = 60

interface PostPageProps {
  params: Promise<{
    locale: string
    id: string
  }>
}

export async function generateStaticParams() {
  const snapshot = await getStaticSnapshot()
  const postIds = new Set(snapshot.postIds)
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const files = await fs.readdir(path.resolve(process.cwd(), 'data/posts'))
    for (const file of files) {
      if (file.endsWith('.json')) {
        postIds.add(file.replace(/\.json$/, ''))
      }
    }
  }
  catch {
    // Ignore if directory missing
  }
  const allIds = Array.from(postIds)
  return NON_DEFAULT_LOCALES.flatMap(locale =>
    allIds.map(id => ({ locale, id })),
  )
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { locale: localeParam, id = '' } = (await params) ?? {}
  const locale = normalizeAppLocale(localeParam)
  return generatePostPageMetadata(locale, id)
}

export default async function PostPage({ params }: PostPageProps) {
  const { locale: localeParam, id = '' } = (await params) ?? {}
  const locale = normalizeAppLocale(localeParam)
  return renderPostPage(locale, id)
}
