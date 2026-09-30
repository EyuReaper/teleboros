import type { SmaQuestion } from '@/lib/sma/types'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { checkHoneypot, checkRateLimit, validateQuestionText } from '@/lib/sma/filter'
import { getActiveSession, getQuestions, getSession, saveQuestion } from '@/lib/sma/store'
import { deriveColorToken, generateClientSeed } from '@/lib/sma/tokens'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId') || undefined
    const questions = await getQuestions(sessionId)

    return NextResponse.json({
      success: true,
      questions,
    })
  }
  catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { text, sessionId, seed, honeypot } = body

    // 1. Honeypot check
    if (!checkHoneypot(honeypot)) {
      // Silently return success to bot
      return NextResponse.json({ success: true, message: 'Received' })
    }

    // 2. Rate limiting check based on client IP or seed
    const reqHeaders = await headers()
    const clientIp = reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-client'
    const rateLimitKey = `${clientIp}-${seed || 'anon'}`

    if (!checkRateLimit(rateLimitKey, 6, 60_000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a moment before sending another inquiry.' },
        { status: 429 },
      )
    }

    // 3. Validation
    const validation = validateQuestionText(text)
    if (!validation.allowed) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // 4. Resolve session
    let targetSession = sessionId ? await getSession(sessionId) : await getActiveSession()
    if (!targetSession) {
      targetSession = await getActiveSession()
    }

    if (!targetSession || targetSession.status === 'ended') {
      return NextResponse.json(
        { error: 'No active S.M.A session is currently accepting inquiries.' },
        { status: 400 },
      )
    }

    // 5. Generate Cryptographic Color Token
    const clientSeed = seed?.trim() || generateClientSeed()
    const colorToken = deriveColorToken(clientSeed)

    const questionId = `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

    const newQuestion: SmaQuestion = {
      id: questionId,
      sessionId: targetSession.id,
      text: text.trim(),
      colorToken,
      senderSeedHash: clientSeed,
      createdAt: new Date().toISOString(),
      status: 'pending',
      reactions: { '👍': 0, '👎': 0, '❤️': 0, '🔥': 0, '💡': 0 },
      netSentiment: 0,
    }

    await saveQuestion(newQuestion)

    return NextResponse.json({
      success: true,
      receipt: {
        questionId: newQuestion.id,
        sessionId: targetSession.id,
        colorToken: newQuestion.colorToken,
        submittedAt: newQuestion.createdAt,
        message: 'Your anonymous inquiry has been safely transmitted.',
      },
    })
  }
  catch (err: any) {
    console.error('[sma api] Error submitting question:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
