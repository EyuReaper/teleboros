import { NextResponse } from 'next/server'
import { addReaction } from '@/lib/sma/store'

const ALLOWED_EMOJIS = new Set(['👍', '👎', '❤️', '🔥'])

export async function POST(req: Request) {
  try {
    const { questionId, emoji } = await req.json()

    if (!questionId || !emoji) {
      return NextResponse.json({ error: 'questionId and emoji are required' }, { status: 400 })
    }

    if (!ALLOWED_EMOJIS.has(emoji)) {
      return NextResponse.json({ error: 'Unsupported reaction emoji' }, { status: 400 })
    }

    const updated = await addReaction(questionId, emoji)
    if (!updated) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      reactions: updated.reactions,
      netSentiment: updated.netSentiment,
    })
  }
  catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
