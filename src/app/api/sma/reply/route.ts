import process from 'node:process'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { getAppConfig } from '@/lib/config'
import { getQuestion, getSession, saveQuestion } from '@/lib/sma/store'
import { dispatchAnswerToDiscussionThread } from '@/lib/sma/telegram'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action = 'reply', questionId, replyText, adminToken, isStarred } = body

    // 1. Verify Admin Token
    const envAdminToken = process.env.ADMIN_TOKEN
    if (!envAdminToken || adminToken !== envAdminToken) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Admin Token' }, { status: 401 })
    }

    if (!questionId) {
      return NextResponse.json({ error: 'questionId is required' }, { status: 400 })
    }

    const question = await getQuestion(questionId)
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const session = await getSession(question.sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // ACTION: Star / Queue toggle
    if (action === 'toggle_star') {
      question.isStarred = Boolean(isStarred ?? !question.isStarred)
      question.status = question.isStarred ? 'queued' : 'pending'
      await saveQuestion(question)
      return NextResponse.json({ success: true, question })
    }

    // ACTION: Dismiss / Purge
    if (action === 'dismiss') {
      question.status = 'dismissed'
      await saveQuestion(question)
      return NextResponse.json({ success: true, question })
    }

    // ACTION: Restore
    if (action === 'restore') {
      question.status = 'pending'
      await saveQuestion(question)
      return NextResponse.json({ success: true, question })
    }

    // ACTION: Reply & Dispatch to Telegram Thread
    if (action === 'reply') {
      if (!replyText?.trim()) {
        return NextResponse.json({ error: 'Reply text cannot be empty' }, { status: 400 })
      }

      const cfg = getAppConfig()
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || cfg.siteUrl || 'https://example.com').replace(/\/+$/, '')

      // Dispatch to Telegram discussion thread
      const dispatchResult = await dispatchAnswerToDiscussionThread(
        session,
        question,
        replyText.trim(),
        siteUrl,
      )

      question.status = 'answered'
      question.reply = dispatchResult.answer || {
        text: replyText.trim(),
        createdAt: new Date().toISOString(),
      }

      await saveQuestion(question)

      revalidatePath('/')
      revalidatePath(`/posts/${session.id}/thread`)
      revalidatePath(`/sessions/${session.id}`)

      return NextResponse.json({
        success: true,
        question,
        deepLink: question.reply.deepLink,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
  catch (err: any) {
    console.error('[sma reply api] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
