import process from 'node:process'
import { NextResponse } from 'next/server'
import { getPresignedUploadUrl } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}))
    const { filename, contentType, adminToken } = body

    // 1. Verify Admin Token
    const envAdminToken = process.env.ADMIN_TOKEN
    if (envAdminToken && adminToken !== envAdminToken) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Admin Token' }, { status: 401 })
    }

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: 'Missing required parameters: filename and contentType' },
        { status: 400 },
      )
    }

    const presigned = await getPresignedUploadUrl(filename, contentType)
    if (!presigned) {
      return NextResponse.json(
        { error: 'Cloudflare R2 storage is not configured or unavailable.' },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      ...presigned,
    })
  }
  catch (error: any) {
    console.error('[teleboros r2 upload] error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate R2 presigned URL' },
      { status: 500 },
    )
  }
}
