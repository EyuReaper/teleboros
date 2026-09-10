import { NextResponse } from 'next/server'
import { savePushSubscription } from '@/lib/push'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { subscription } = body

    if (!subscription) {
      return NextResponse.json({ error: 'Push subscription payload is required.' }, { status: 400 })
    }

    const saved = await savePushSubscription(subscription)
    if (!saved) {
      return NextResponse.json({ error: 'Failed to record subscription.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Web Push subscription registered.' })
  }
  catch (err: any) {
    console.error('[teleboros push] subscribe error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
