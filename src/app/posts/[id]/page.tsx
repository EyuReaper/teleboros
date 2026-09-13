import type { Metadata } from 'next'
import { DEFAULT_LOCALE } from '@/lib/i18n'
import { generatePostPageMetadata, renderPostPage } from '@/lib/pages/post-page'
import { getStaticSnapshot } from '@/lib/telegram/static-snapshot'

export const dynamic = 'auto'
export const dynamicParams = true
export const revalidate = 60

interface DefaultPostPageProps {
  params: Promise<{
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
  return Array.from(postIds).map(id => ({ id }))
}

export async function generateMetadata({ params }: DefaultPostPageProps): Promise<Metadata> {
  const { id = '' } = (await params) ?? {}
  return generatePostPageMetadata(DEFAULT_LOCALE, id)
}

export default async function DefaultPostPage({ params }: DefaultPostPageProps) {
  const { id = '' } = (await params) ?? {}
  return renderPostPage(DEFAULT_LOCALE, id)
}
