import process from 'node:process'
import { type HandleUploadBody, handleUpload } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { getPrimaryStorageName, uploadMedia } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<NextResponse> {
  const contentType = request.headers.get('content-type') || ''

  // 1. Direct Multipart Form Upload (supports Local, R2, and VPS deployments)
  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData()
      const adminToken = formData.get('adminToken') as string
      const file = formData.get('file') as File | null

      const envAdminToken = process.env.ADMIN_TOKEN
      if (envAdminToken && adminToken !== envAdminToken) {
        return NextResponse.json({ error: 'Unauthorized: Invalid Admin Token' }, { status: 401 })
      }

      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
      }

      const result = await uploadMedia(file, file.name, file.type)
      return NextResponse.json({
        success: true,
        url: result.url,
        key: result.key,
        storage: getPrimaryStorageName(),
      })
    }
    catch (err: any) {
      console.error('[teleboros upload] multipart upload error:', err)
      return NextResponse.json(
        { error: err.message || 'Failed to process multipart upload' },
        { status: 500 },
      )
    }
  }

  // 2. Vercel Blob Client Upload Flow
  const body = (await request.json().catch(() => ({}))) as HandleUploadBody

  let blobToken = process.env.BLOB_READ_WRITE_TOKEN
  if (!blobToken) {
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === 'string' && value.startsWith('vercel_blob_rw_')) {
        blobToken = value
        break
      }
      if (key.toUpperCase().includes('BLOB') && key.toUpperCase().includes('TOKEN') && value) {
        blobToken = value
        break
      }
    }
  }

  if (!blobToken) {
    return NextResponse.json(
      {
        error:
          'BLOB_READ_WRITE_TOKEN is not configured. For direct streaming, ensure R2 or Vercel Blob credentials are set in environment variables.',
      },
      { status: 400 },
    )
  }

  try {
    const jsonResponse = await handleUpload({
      token: blobToken,
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        // Verify Admin Token
        const envAdminToken = process.env.ADMIN_TOKEN
        if (envAdminToken) {
          let providedToken = ''
          if (clientPayload) {
            try {
              const parsed = JSON.parse(clientPayload)
              providedToken = parsed.adminToken
            }
            catch {
              // Ignore parse failure
            }
          }
          if (!providedToken) {
            providedToken = request.headers.get('x-admin-token') || ''
          }
          if (providedToken !== envAdminToken) {
            throw new Error('Unauthorized: Invalid Admin Token')
          }
        }

        return {
          allowedContentTypes: [
            'video/mp4',
            'video/webm',
            'video/quicktime',
            'video/x-matroska',
            'video/avi',
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/svg+xml',
          ],
          maximumSizeInBytes: 500 * 1024 * 1024,
          tokenPayload: JSON.stringify({ authorized: true }),
        }
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('[teleboros blob] Upload completed successfully:', blob.url)
      },
    })

    return NextResponse.json(jsonResponse)
  }
  catch (error: any) {
    console.error('[teleboros blob] handleUpload error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to authorize Blob upload' },
      { status: 400 },
    )
  }
}
