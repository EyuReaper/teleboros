import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { marked } from 'marked'
import { sanitizePostHtml } from './sanitize'

export interface LongFormPost {
  id: string
  title?: string
  text: string
  html: string
  condensedText?: string
  createdAt: string
}

const LONG_FORM_DATA_DIR = path.resolve(process.cwd(), 'data/posts')

export function getLongFormFilePath(id: string): string {
  return path.join(LONG_FORM_DATA_DIR, `${id}.json`)
}

/**
 * Render Markdown into sanitized HTML suitable for Teleboros article pages.
 */
export async function renderMarkdownToHtml(markdown: string): Promise<string> {
  const rawHtml = await marked.parse(markdown)
  return sanitizePostHtml(rawHtml)
}

function extractTitleFromMarkdown(text: string): string {
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#')) {
      const title = trimmed.replace(/^#+\s*/, '').trim()
      if (title) {
        return title
      }
    }
  }
  return ''
}

/**
 * Save a full-length long-form post to local JSON storage.
 */
export async function saveLongFormPost(
  id: string,
  text: string,
  condensedText?: string,
  title?: string,
): Promise<LongFormPost> {
  await mkdir(LONG_FORM_DATA_DIR, { recursive: true })

  const html = await renderMarkdownToHtml(text)
  const inferredTitle = title?.trim() || extractTitleFromMarkdown(text) || text.slice(0, 80).split('\n')[0]?.trim() || `Post ${id}`

  const post: LongFormPost = {
    id,
    title: inferredTitle,
    text,
    html,
    condensedText,
    createdAt: new Date().toISOString(),
  }

  const filePath = getLongFormFilePath(id)
  await writeFile(filePath, JSON.stringify(post, null, 2), 'utf8')
  return post
}

/**
 * Load a full-length long-form post by ID if it exists.
 */
export async function loadLongFormPost(id: string): Promise<LongFormPost | null> {
  try {
    const filePath = getLongFormFilePath(id)
    const content = await readFile(filePath, 'utf8')
    return JSON.parse(content) as LongFormPost
  }
  catch {
    return null
  }
}
