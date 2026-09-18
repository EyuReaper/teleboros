import type { LongFormPost, PresignedUploadUrl, StorageAdapter, StorageUploadResult } from '../types'
import process from 'node:process'

export class SupabaseStorageAdapter implements StorageAdapter {
  readonly name = 'supabase' as const

  private getCredentials() {
    const rawUrl = (process.env.SUPABASE_URL || '').trim()
    const url = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '').trim()
    const bucket = (process.env.SUPABASE_BUCKET_NAME || 'teleboros').trim()

    return { url, key, bucket }
  }

  isConfigured(): boolean {
    const { url, key } = this.getCredentials()
    return Boolean(url && key)
  }

  private getHeaders(contentType?: string): Record<string, string> {
    const { key } = this.getCredentials()
    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      apikey: key,
    }
    if (contentType) {
      headers['Content-Type'] = contentType
    }
    return headers
  }

  async uploadMedia(
    file: Buffer | Uint8Array | ArrayBuffer | Blob,
    filename: string,
    contentType: string,
  ): Promise<StorageUploadResult> {
    const { url, bucket } = this.getCredentials()
    if (!this.isConfigured()) {
      throw new Error('Supabase Storage is not configured (requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).')
    }

    const safeName = filename.replace(/[^\w.-]/g, '_')
    const uniqueFilename = `${Date.now()}-${safeName}`
    const objectPath = `media/${uniqueFilename}`

    let bodyData: any = file
    let size = 0
    if (typeof (file as any)?.arrayBuffer === 'function') {
      const arrayBuf = await (file as any).arrayBuffer()
      bodyData = Buffer.from(arrayBuf)
      size = bodyData.length
    }
    else if (typeof Blob !== 'undefined' && file instanceof Blob) {
      bodyData = file
      size = file.size
    }
    else if (file instanceof ArrayBuffer) {
      bodyData = Buffer.from(file)
      size = file.byteLength
    }
    else if (Buffer.isBuffer(file)) {
      bodyData = file
      size = file.length
    }

    const uploadUrl = `${url}/storage/v1/object/${bucket}/${objectPath}`
    const headers = this.getHeaders(contentType || 'application/octet-stream')
    headers['x-upsert'] = 'true'

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: bodyData,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Supabase upload failed (${res.status} ${res.statusText}): ${errText}`)
    }

    const publicUrl = `${url}/storage/v1/object/public/${bucket}/${objectPath}`

    return {
      url: publicUrl,
      key: objectPath,
      size,
      contentType,
    }
  }

  async savePost(id: string, post: LongFormPost): Promise<void> {
    const { url, bucket } = this.getCredentials()
    if (!this.isConfigured()) {
      throw new Error('Supabase Storage is not configured.')
    }

    const objectPath = `posts/${id}.json`
    const uploadUrl = `${url}/storage/v1/object/${bucket}/${objectPath}`
    const headers = this.getHeaders('application/json; charset=utf-8')
    headers['x-upsert'] = 'true'

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(post, null, 2),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Supabase savePost failed (${res.status} ${res.statusText}): ${errText}`)
    }
  }

  async loadPost(id: string): Promise<LongFormPost | null> {
    const { url, bucket } = this.getCredentials()
    if (!this.isConfigured()) {
      return null
    }

    const objectPath = `posts/${id}.json`

    // 1. Try public CDN endpoint first (fast, edge-cached)
    try {
      const publicUrl = `${url}/storage/v1/object/public/${bucket}/${objectPath}`
      const res = await fetch(publicUrl, { next: { revalidate: 60 } })
      if (res.ok) {
        return (await res.json()) as LongFormPost
      }
    }
    catch {
      // Continue to authenticated fetch fallback
    }

    // 2. Authenticated fallback
    try {
      const authUrl = `${url}/storage/v1/object/authenticated/${bucket}/${objectPath}`
      const res = await fetch(authUrl, {
        headers: this.getHeaders(),
        next: { revalidate: 60 },
      })
      if (res.ok) {
        return (await res.json()) as LongFormPost
      }
    }
    catch (err: any) {
      console.warn(`[teleboros supabase] Error loading post ${id}:`, err?.message || err)
    }

    return null
  }

  async getPresignedUploadUrl(
    filename: string,
    contentType: string,
  ): Promise<PresignedUploadUrl> {
    const { url, bucket } = this.getCredentials()
    const safeName = filename.replace(/[^\w.-]/g, '_')
    const objectPath = `media/${Date.now()}-${safeName}`

    // Supabase supports client upload with apikey header
    return {
      uploadUrl: `${url}/storage/v1/object/${bucket}/${objectPath}`,
      publicUrl: `${url}/storage/v1/object/public/${bucket}/${objectPath}`,
      method: 'POST',
      headers: {
        ...this.getHeaders(contentType || 'application/octet-stream'),
        'x-upsert': 'true',
      },
    }
  }
}
