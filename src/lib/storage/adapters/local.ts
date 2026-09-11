import type { LongFormPost, StorageAdapter, StorageUploadResult } from '../types'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'local' as const

  private postsDir: string
  private uploadsDir: string

  constructor() {
    this.postsDir = path.resolve(process.cwd(), 'data/posts')
    this.uploadsDir = path.resolve(process.cwd(), 'public/uploads')
  }

  isConfigured(): boolean {
    return true
  }

  private getPostFilePath(id: string): string {
    return path.join(this.postsDir, `${id}.json`)
  }

  async uploadMedia(
    file: Buffer | Uint8Array | ArrayBuffer | Blob,
    filename: string,
    contentType: string,
  ): Promise<StorageUploadResult> {
    const safeName = filename.replace(/[^\w.-]/g, '_')
    const uniqueFilename = `${Date.now()}-${safeName}`

    try {
      await mkdir(this.uploadsDir, { recursive: true })
    }
    catch (err: any) {
      if (err?.code !== 'EEXIST') {
        console.warn('[teleboros local] mkdir uploadsDir error:', err)
      }
    }

    const filePath = path.join(this.uploadsDir, uniqueFilename)

    let buffer: Buffer
    if (typeof Blob !== 'undefined' && file instanceof Blob) {
      const arr = await file.arrayBuffer()
      buffer = Buffer.from(arr)
    }
    else if (file instanceof ArrayBuffer) {
      buffer = Buffer.from(file)
    }
    else {
      buffer = Buffer.from(file as any)
    }

    try {
      await writeFile(filePath, buffer)
    }
    catch (err: any) {
      if (err?.code === 'EROFS') {
        console.warn('[teleboros local] Filesystem is read-only (EROFS), skipping local media write')
      }
      else {
        throw err
      }
    }

    return {
      url: `/uploads/${uniqueFilename}`,
      key: uniqueFilename,
      size: buffer.byteLength,
      contentType,
    }
  }

  async savePost(id: string, post: LongFormPost): Promise<void> {
    try {
      await mkdir(this.postsDir, { recursive: true })
      const filePath = this.getPostFilePath(id)
      await writeFile(filePath, JSON.stringify(post, null, 2), 'utf8')
    }
    catch (err: any) {
      if (err?.code !== 'EROFS') {
        console.warn(`[teleboros local] Failed to write post ${id} to filesystem:`, err?.message || err)
      }
    }
  }

  async loadPost(id: string): Promise<LongFormPost | null> {
    try {
      const filePath = this.getPostFilePath(id)
      const content = await readFile(filePath, 'utf8')
      return JSON.parse(content) as LongFormPost
    }
    catch {
      return null
    }
  }
}
