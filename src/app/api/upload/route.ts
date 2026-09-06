import process from 'node:process'
import { type HandleUploadBody, handleUpload } from '@vercel/blob/client'
import { NextResponse } from 'next/server'

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN
  if (!blobToken) {
    return NextResponse.json(
      {
        error:
          'BLOB_READ_WRITE_TOKEN is not configured. Please connect Vercel Blob in your Vercel Dashboard (Storage -> Blob).',
      },
      { status: 500 },
    )
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        // 1. Verify Admin Token
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

        // 2. Configure allowed types and limits
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
          maximumSizeInBytes: 500 * 1024 * 1024, // Up to 500 MB
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
