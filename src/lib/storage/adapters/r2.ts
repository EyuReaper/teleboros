import type { LongFormPost, PresignedUploadUrl, StorageAdapter, StorageUploadResult } from '../types'
import process from 'node:process'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export class CloudflareR2Adapter implements StorageAdapter {
  readonly name = 'r2' as const

  private client: S3Client | null = null

  private getCredentials() {
    const accountId = process.env.R2_ACCOUNT_ID?.trim()
    const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
    const bucketName = process.env.R2_BUCKET_NAME?.trim()
    const publicDomain = (process.env.R2_PUBLIC_DOMAIN?.trim() || '').replace(/\/+$/, '')

    return { accountId, accessKeyId, secretAccessKey, bucketName, publicDomain }
  }

  isConfigured(): boolean {
    const { accountId, accessKeyId, secretAccessKey, bucketName } = this.getCredentials()
    return Boolean(accountId && accessKeyId && secretAccessKey && bucketName)
  }

  private getS3Client(): { client: S3Client, bucketName: string, publicDomain: string } {
    const { accountId, accessKeyId, secretAccessKey, bucketName, publicDomain } = this.getCredentials()
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('Cloudflare R2 credentials are not fully configured (requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).')
    }

    if (!this.client) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      })
    }

    return { client: this.client, bucketName, publicDomain }
  }

  private buildPublicUrl(key: string, publicDomain: string, bucketName: string, accountId?: string): string {
    const cleanKey = key.replace(/^\/+/, '')
    if (publicDomain) {
      return `${publicDomain}/${cleanKey}`
    }
    return `https://${bucketName}.${accountId || 'r2'}.cloudflarestorage.com/${cleanKey}`
  }

  async uploadMedia(
    file: Buffer | Uint8Array | ArrayBuffer | Blob,
    filename: string,
    contentType: string,
  ): Promise<StorageUploadResult> {
    const { client, bucketName, publicDomain } = this.getS3Client()
    const { accountId } = this.getCredentials()
    const safeName = filename.replace(/[^\w.-]/g, '_')
    const key = `media/${Date.now()}-${safeName}`

    let bodyData: Buffer | Uint8Array
    if (typeof Blob !== 'undefined' && file instanceof Blob) {
      const arr = await file.arrayBuffer()
      bodyData = Buffer.from(arr)
    }
    else if (file instanceof ArrayBuffer) {
      bodyData = Buffer.from(file)
    }
    else {
      bodyData = file as Buffer | Uint8Array
    }

    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: bodyData,
        ContentType: contentType || 'application/octet-stream',
      }),
    )

    const url = this.buildPublicUrl(key, publicDomain, bucketName, accountId)
    return {
      url,
      key,
      size: bodyData.byteLength,
      contentType,
    }
  }

  async savePost(id: string, post: LongFormPost): Promise<void> {
    const { client, bucketName } = this.getS3Client()
    const key = `posts/${id}.json`

    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: JSON.stringify(post, null, 2),
        ContentType: 'application/json; charset=utf-8',
      }),
    )
  }

  async loadPost(id: string): Promise<LongFormPost | null> {
    const { client, bucketName, publicDomain } = this.getS3Client()
    const key = `posts/${id}.json`

    // 1. If public domain is available, try fast HTTP GET first
    if (publicDomain) {
      try {
        const publicUrl = this.buildPublicUrl(key, publicDomain, bucketName)
        const res = await fetch(publicUrl, { next: { revalidate: 60 } })
        if (res.ok) {
          return (await res.json()) as LongFormPost
        }
      }
      catch {
        // Fall back to direct S3 GetObject
      }
    }

    // 2. Direct S3 GetObjectCommand
    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
      const response = await client.send(command)
      const bodyStr = await response.Body?.transformToString()
      if (bodyStr) {
        return JSON.parse(bodyStr) as LongFormPost
      }
    }
    catch (err: any) {
      if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
        return null
      }
      console.warn(`[teleboros r2] Error reading post ${id}:`, err?.message || err)
    }

    return null
  }

  async getPresignedUploadUrl(
    filename: string,
    contentType: string,
  ): Promise<PresignedUploadUrl> {
    const { client, bucketName, publicDomain } = this.getS3Client()
    const { accountId } = this.getCredentials()
    const safeName = filename.replace(/[^\w.-]/g, '_')
    const key = `media/${Date.now()}-${safeName}`

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType || 'application/octet-stream',
    })

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 })
    const publicUrl = this.buildPublicUrl(key, publicDomain, bucketName, accountId)

    return {
      uploadUrl,
      publicUrl,
      method: 'PUT',
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
      },
    }
  }
}
