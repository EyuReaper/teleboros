import type { Tokens } from 'marked'
import { Marked } from 'marked'

export interface ParsedFrontmatter {
  title?: string
  tags?: string[]
  cover?: string
  date?: string
  description?: string
  [key: string]: any
}

export interface ParsedMarkdownResult {
  frontmatter: ParsedFrontmatter
  body: string
}

/**
 * Parse YAML-style frontmatter from markdown content.
 * Handles YAML frontmatter between opening and closing '---' markers.
 */
export function parseMarkdownFrontmatter(content: string): ParsedMarkdownResult {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, body: content }
  }

  const endIndex = trimmed.indexOf('\n---', 3)
  if (endIndex === -1) {
    return { frontmatter: {}, body: content }
  }

  const rawYaml = trimmed.slice(3, endIndex).trim()
  const body = trimmed.slice(endIndex + 4).replace(/^\r?\n/, '')

  const frontmatter: ParsedFrontmatter = {}
  const lines = rawYaml.split('\n')
  let currentKey: string | null = null

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue
    }

    // Array item continuation: - item
    if (trimmedLine.startsWith('-') && currentKey) {
      const val = trimmedLine.replace(/^-\s*/, '').trim().replace(/^['"]|['"]$/g, '')
      if (Array.isArray(frontmatter[currentKey])) {
        frontmatter[currentKey].push(val)
      }
      else {
        frontmatter[currentKey] = [val]
      }
      continue
    }

    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) {
      continue
    }

    const key = line.slice(0, colonIndex).trim()
    let value = line.slice(colonIndex + 1).trim()
    currentKey = key

    // Array inline: [item1, item2]
    if (value.startsWith('[') && value.endsWith(']')) {
      const items = value
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
      frontmatter[key] = items
    }
    // String value
    else if (value) {
      value = value.replace(/^['"]|['"]$/g, '')
      if (key === 'tags') {
        frontmatter.tags = value.split(',').map(s => s.trim().replace(/^#/, '')).filter(Boolean)
      }
      else {
        frontmatter[key] = value
      }
    }
    else {
      // Key might be followed by list items on next lines
      frontmatter[key] = []
    }
  }

  // Ensure tags are an array
  if (frontmatter.tags && !Array.isArray(frontmatter.tags)) {
    frontmatter.tags = [String(frontmatter.tags)]
  }

  return { frontmatter, body }
}

/**
 * Extract all local relative media path references from markdown text.
 * Skips remote URLs (http/https/data/blob).
 */
export function extractLocalMediaReferences(markdown: string): string[] {
  const references = new Set<string>()

  // 1. Markdown image syntax: ![alt](path "optional title")
  const mdImgMatches = markdown.matchAll(/!\[.*?\]\(([^)\s]+)(?:\s+["'].*?["'])?\)/g)
  for (const match of mdImgMatches) {
    const src = match[1]?.trim()
    if (src && isRelativeMediaPath(src)) {
      references.add(src)
    }
  }

  // 2. HTML img syntax: <img ... src="path" ...>
  const htmlImgMatches = markdown.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)
  for (const match of htmlImgMatches) {
    const src = match[1]?.trim()
    if (src && isRelativeMediaPath(src)) {
      references.add(src)
    }
  }

  // 3. HTML video syntax: <video ... src="path" ...> or <source src="path">
  const mediaMatches = markdown.matchAll(/<(?:video|source)[^>]+src=["']([^"']+)["'][^>]*>/gi)
  for (const match of mediaMatches) {
    const src = match[1]?.trim()
    if (src && isRelativeMediaPath(src)) {
      references.add(src)
    }
  }

  return Array.from(references)
}

function isRelativeMediaPath(path: string): boolean {
  if (!path)
    return false
  if (path.startsWith('http://') || path.startsWith('https://'))
    return false
  if (path.startsWith('data:') || path.startsWith('blob:'))
    return false
  if (path.startsWith('//'))
    return false
  return true
}

/**
 * Rewrite local media references in markdown to permanent uploaded CDN URLs.
 */
export function rewriteMarkdownMediaUrls(markdown: string, urlMap: Record<string, string> | Map<string, string>): string {
  const getReplacement = (path: string): string | undefined => {
    if (urlMap instanceof Map) {
      return urlMap.get(path) || urlMap.get(decodeURIComponent(path)) || urlMap.get(path.replace(/^\.\//, ''))
    }
    return urlMap[path] || urlMap[decodeURIComponent(path)] || urlMap[path.replace(/^\.\//, '')]
  }

  // 1. Replace Markdown images: ![alt](path)
  let rewritten = markdown.replace(/(!\[.*?\]\()([^)\s]+)((?:\s+["'].*?["'])?\))/g, (fullMatch, prefix, src, suffix) => {
    const replacement = getReplacement(src.trim())
    return replacement ? `${prefix}${replacement}${suffix}` : fullMatch
  })

  // 2. Replace HTML img/video src: <img src="path">
  rewritten = rewritten.replace(/(<(?:img|video|source)[^>]+src=["'])([^"']+)(["'][^>]*>)/gi, (fullMatch, prefix, src, suffix) => {
    const replacement = getReplacement(src.trim())
    return replacement ? `${prefix}${replacement}${suffix}` : fullMatch
  })

  return rewritten
}

/**
 * Configured marked instance with compact article media rendering and lightbox zoomable support.
 */
export const articleMarked = new Marked({
  breaks: true,
  gfm: true,
})

// Configure custom image renderer
articleMarked.use({
  renderer: {
    image({ href, title, text }: Tokens.Image) {
      const cleanHref = href || ''
      const cleanAlt = text || ''
      const titleAttr = title ? ` title="${title}"` : ''
      const captionHtml = cleanAlt
        ? `<figcaption class="article-media-caption mt-1.5 text-xs text-muted-foreground text-center font-normal">${cleanAlt}</figcaption>`
        : ''

      return `<figure class="article-media-wrapper my-4 flex flex-col items-center justify-center text-center"><img src="${cleanHref}" alt="${cleanAlt}"${titleAttr} class="zoomable article-media-compact" loading="lazy" />${captionHtml}</figure>`
    },
  },
})

/**
 * Render article markdown to HTML with compact media framing and zoomable lightbox hooks.
 */
export async function renderArticleMarkdown(markdown: string): Promise<string> {
  if (!markdown)
    return ''
  const parsed = await articleMarked.parse(markdown)
  return parsed
}
