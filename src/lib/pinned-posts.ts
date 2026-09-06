import type { ImageMeta } from '@/lib/image-meta'
import type { ChannelPost } from '@/lib/types'
import { extractMediaFilename } from '@/lib/image-meta'

/**
 * Extracts all media filenames referenced within a post's rendered HTML.
 */
export function extractPostMediaFilenames(html: string): string[] {
  if (!html) {
    return []
  }

  const filenames: string[] = []
  const regex = /(?:src|poster)=["']([^"']+)["']/gi
  let match: RegExpExecArray | null = regex.exec(html)

  while (match !== null) {
    const src = match[1]
    if (src && (src.includes('/media/') || src.includes('/media%2F'))) {
      const filename = extractMediaFilename(src)
      if (filename && !filenames.includes(filename)) {
        filenames.push(filename)
      }
    }
    match = regex.exec(html)
  }

  return filenames
}

/**
 * Enriches posts with dominant accent colors extracted from image metadata.
 */
export function enrichPostsWithAccentColors(
  posts: ChannelPost[],
  imageMetaMap: Record<string, ImageMeta>,
): ChannelPost[] {
  for (const post of posts) {
    if (post.accentColor) {
      continue
    }

    const mediaFilenames = extractPostMediaFilenames(post.content)
    for (const filename of mediaFilenames) {
      const meta = imageMetaMap[filename]
      if (meta?.c) {
        post.accentColor = meta.c
        break
      }
    }
  }

  return posts
}

/**
 * Determines whether a given post is pinned via configuration, tag, or post flag.
 */
export function isPostPinned(post: ChannelPost, configPinnedIds?: string[]): boolean {
  if (post.isPinned) {
    return true
  }

  if (configPinnedIds && configPinnedIds.includes(post.id)) {
    return true
  }

  if (post.tags && post.tags.length > 0) {
    const hasPinnedTag = post.tags.some((rawTag) => {
      const tag = rawTag.toLowerCase().replace(/^#/, '').trim()
      return tag === 'pinned' || tag === 'featured'
    })
    if (hasPinnedTag) {
      return true
    }
  }

  return false
}

/**
 * Separates posts into pinned and unpinned lists.
 * Pinned posts are deduplicated from the unpinned list so they don't appear twice.
 */
export function resolvePinnedPosts(
  posts: ChannelPost[],
  configPinnedIds: string[] = [],
): { pinned: ChannelPost[], unpinned: ChannelPost[] } {
  const pinnedMap = new Map<string, ChannelPost>()
  const unpinned: ChannelPost[] = []

  // 1. Check for explicitly ordered config pinned posts first
  for (const id of configPinnedIds) {
    const found = posts.find(p => p.id === String(id))
    if (found && !pinnedMap.has(found.id)) {
      pinnedMap.set(found.id, { ...found, isPinned: true })
    }
  }

  // 2. Check for tag or flag pinned posts
  for (const post of posts) {
    if (pinnedMap.has(post.id)) {
      continue
    }

    if (isPostPinned(post, configPinnedIds)) {
      pinnedMap.set(post.id, { ...post, isPinned: true })
    }
    else {
      unpinned.push(post)
    }
  }

  const pinned = Array.from(pinnedMap.values())
  return { pinned, unpinned }
}
