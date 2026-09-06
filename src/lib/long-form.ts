import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { list, put } from '@vercel/blob'
import { marked } from 'marked'
import { sanitizePostHtml } from './sanitize'

export interface LongFormPost {
  id: string
  title?: string
  text: string
  html: string
  condensedText?: string
  mediaUrl?: string
  mediaType?: 'video' | 'image'
  createdAt: string
}

const LONG_FORM_DATA_DIR = path.resolve(process.cwd(), 'data/posts')

function getBlobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return process.env.BLOB_READ_WRITE_TOKEN.trim()
  }
  const matched = Object.entries(process.env).find(([k, v]) => k.includes('BLOB') && k.includes('TOKEN') && v?.trim())
  return matched ? matched[1]?.trim() : undefined
}

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
  mediaUrl?: string,
  mediaType?: 'video' | 'image',
): Promise<LongFormPost> {
  let html = await renderMarkdownToHtml(text)
  const inferredTitle = title?.trim() || extractTitleFromMarkdown(text) || text.slice(0, 80).split('\n')[0]?.trim() || `Post ${id}`

  if (mediaUrl) {
    if (mediaType === 'video') {
      const videoTag = `<div class="tgme_widget_message_video_wrap mb-4"><video src="${mediaUrl}" class="post-video w-full rounded-xl" controls playsinline preload="metadata"></video></div>\n`
      html = `${videoTag}${html}`
    }
    else if (mediaType === 'image') {
      const imgTag = `<div class="image-list-container mb-4"><img src="${mediaUrl}" alt="${inferredTitle}" class="zoomable rounded-xl" loading="lazy" /></div>\n`
      html = `${imgTag}${html}`
    }
  }

  const post: LongFormPost = {
    id,
    title: inferredTitle,
    text,
    html,
    condensedText,
    mediaUrl,
    mediaType,
    createdAt: new Date().toISOString(),
  }

  // 1. Persist to Vercel Blob if configured
  const blobToken = getBlobToken()
  if (blobToken) {
    try {
      await put(`data/posts/${id}.json`, JSON.stringify(post, null, 2), {
        access: 'public',
        addRandomSuffix: false,
        token: blobToken,
      })
    }
    catch (blobErr) {
      console.warn('[teleboros] Failed to persist post to Vercel Blob:', blobErr)
    }
  }

  // 2. Persist to local filesystem (ignoring EROFS on serverless environments like Vercel)
  try {
    await mkdir(LONG_FORM_DATA_DIR, { recursive: true })
    const filePath = getLongFormFilePath(id)
    await writeFile(filePath, JSON.stringify(post, null, 2), 'utf8')
  }
  catch (fsErr: any) {
    if (fsErr?.code !== 'EROFS') {
      console.warn('[teleboros] Failed to write local post file:', fsErr)
    }
  }

  return post
}

/**
 * Load a full-length long-form post by ID if it exists.
 */
export async function loadLongFormPost(id: string): Promise<LongFormPost | null> {
  // 1. Try local filesystem
  try {
    const filePath = getLongFormFilePath(id)
    const content = await readFile(filePath, 'utf8')
    return JSON.parse(content) as LongFormPost
  }
  catch {
    // Continue to Blob fallback
  }

  // 2. Try Vercel Blob storage
  const blobToken = getBlobToken()
  if (blobToken) {
    try {
      const { blobs } = await list({ prefix: `data/posts/${id}.json`, token: blobToken })
      if (blobs.length > 0) {
        const res = await fetch(blobs[0].url)
        if (res.ok) {
          return (await res.json()) as LongFormPost
        }
      }
    }
    catch {
      // Ignore
    }
  }

  return null
}
