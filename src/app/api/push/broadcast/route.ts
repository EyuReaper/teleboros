import process from 'node:process'
import { NextResponse } from 'next/server'
import { broadcastPushNotification } from '@/lib/push'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { title, body: text, url, icon, adminToken } = body

    const envAdminToken = process.env.ADMIN_TOKEN
    if (envAdminToken && adminToken !== envAdminToken) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Admin Token' }, { status: 401 })
    }

    if (!title || !text) {
      return NextResponse.json({ error: 'Title and body are required.' }, { status: 400 })
    }

    const result = await broadcastPushNotification({ title, body: text, url, icon })
    return NextResponse.json({
      success: true,
      ...result,
    })
  }
  catch (err: any) {
    console.error('[teleboros push] broadcast error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
