import type { LongFormPost, StorageAdapter, StorageUploadResult } from '../types'
import process from 'node:process'
import { list, put } from '@vercel/blob'

export class VercelBlobStorageAdapter implements StorageAdapter {
  readonly name = 'blob' as const

  private getToken(): string | undefined {
    if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
      return process.env.BLOB_READ_WRITE_TOKEN.trim()
    }
    const matched = Object.entries(process.env).find(
      ([k, v]) => k.includes('BLOB') && k.includes('TOKEN') && v?.trim(),
    )
    return matched ? matched[1]?.trim() : undefined
  }

  isConfigured(): boolean {
    return Boolean(this.getToken())
  }

  async uploadMedia(
    file: Buffer | Uint8Array | ArrayBuffer | Blob,
    filename: string,
    contentType: string,
  ): Promise<StorageUploadResult> {
    const token = this.getToken()
    if (!token) {
      throw new Error('Vercel Blob token is not configured.')
    }

    const safeName = filename.replace(/[^\w.-]/g, '_')
    const key = `media/${Date.now()}-${safeName}`

    let bodyData: any = file
    if (typeof Blob !== 'undefined' && file instanceof Blob) {
      bodyData = file
    }
    else if (file instanceof ArrayBuffer) {
      bodyData = Buffer.from(file)
    }

    const result = await put(key, bodyData, {
      access: 'public',
      contentType: contentType || undefined,
      token,
    })

    return {
      url: result.url,
      key: result.pathname,
      contentType,
    }
  }

  async savePost(id: string, post: LongFormPost): Promise<void> {
    const token = this.getToken()
    if (!token) {
      throw new Error('Vercel Blob token is not configured.')
    }

    await put(`data/posts/${id}.json`, JSON.stringify(post, null, 2), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
      token,
    })
  }

  async loadPost(id: string): Promise<LongFormPost | null> {
    const token = this.getToken()
    if (!token) {
      return null
    }

    try {
      const { blobs } = await list({
        prefix: `data/posts/${id}.json`,
        token,
      })

      if (blobs.length > 0) {
        const res = await fetch(blobs[0].url, { next: { revalidate: 60 } })
        if (res.ok) {
          return (await res.json()) as LongFormPost
        }
      }
    }
    catch (err: any) {
      console.warn(`[teleboros blob] Error loading post ${id}:`, err?.message || err)
    }

    return null
  }
}
