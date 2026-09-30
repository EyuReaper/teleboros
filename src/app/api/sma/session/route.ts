import type { SmaSession } from '@/lib/sma/types'
import process from 'node:process'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { getAppConfig } from '@/lib/config'
import { saveLongFormPost } from '@/lib/long-form'
import { getActiveSession, getQuestions, getSession, getSessions, saveSession } from '@/lib/sma/store'
import { broadcastSmaRecap, broadcastSmaSessionLaunch, discoverLinkedDiscussionChat } from '@/lib/sma/telegram'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('id')
    const listAll = searchParams.get('all') === 'true'

    if (listAll) {
      const allSessions = await getSessions()
      return NextResponse.json({ success: true, sessions: allSessions })
    }

    const session = sessionId ? await getSession(sessionId) : await getActiveSession()
    if (!session) {
      return NextResponse.json({ success: true, session: null })
    }

    const questions = await getQuestions(session.id)
    const answeredCount = questions.filter(q => q.status === 'answered' || Boolean(q.reply)).length
    const totalNetSentiment = questions.reduce((acc, q) => acc + (q.netSentiment || 0), 0)

    session.stats = {
      totalQuestions: questions.length,
      answeredQuestions: answeredCount,
      netSentiment: totalNetSentiment,
    }

    return NextResponse.json({
      success: true,
      session,
    })
  }
  catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action, adminToken, title, headline, promptMessage, durationMinutes, sessionId } = body

    // 1. Verify Admin Token
    const envAdminToken = process.env.ADMIN_TOKEN
    if (!envAdminToken || adminToken !== envAdminToken) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Admin Token' }, { status: 401 })
    }

    const cfg = getAppConfig()
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || cfg.siteUrl || 'https://example.com').replace(/\/+$/, '')

    // ACTION: Create & Launch New Session
    if (action === 'create') {
      const existing = await getActiveSession()
      if (existing) {
        existing.status = 'ended'
        existing.endedAt = new Date().toISOString()
        await saveSession(existing)
      }

      const newId = `sma-${Date.now().toString(36)}`
      const newSession: SmaSession = {
        id: newId,
        title: title?.trim() || 'Live Ask Me Anything & Anonymous Q&A',
        headline: headline?.trim() || 'Live S.M.A Session is active!',
        promptMessage: promptMessage?.trim() || 'Drop your anonymous thoughts, engineering queries, or deep questions.',
        status: 'active',
        createdAt: new Date().toISOString(),
      }

      // Discover linked discussion group if Bot Token is set
      const botToken = process.env.TELEGRAM_BOT_TOKEN
      const channelChatId = process.env.TELEGRAM_CHAT_ID
      if (botToken && channelChatId) {
        const linkedChat = await discoverLinkedDiscussionChat(botToken, channelChatId)
        if (linkedChat) {
          newSession.linkedDiscussionChatId = linkedChat
        }

        // Broadcast announcement to channel
        const broadcastRes = await broadcastSmaSessionLaunch(newSession, siteUrl)
        if (broadcastRes.channelPostId) {
          newSession.channelPostId = broadcastRes.channelPostId
        }
      }

      await saveSession(newSession)
      revalidatePath('/')
      revalidatePath('/sma')

      return NextResponse.json({ success: true, session: newSession })
    }

    // Resolve target session for subsequent actions
    const currentSession = sessionId ? await getSession(sessionId) : await getActiveSession()
    if (!currentSession) {
      return NextResponse.json({ error: 'Session not found or no active session' }, { status: 404 })
    }

    // ACTION: Update Homepage Banner / Prompts
    if (action === 'update_banner') {
      if (headline)
        currentSession.headline = headline.trim()
      if (promptMessage)
        currentSession.promptMessage = promptMessage.trim()
      if (title)
        currentSession.title = title.trim()

      await saveSession(currentSession)
      revalidatePath('/')
      return NextResponse.json({ success: true, session: currentSession })
    }

    // ACTION: Start Wrap-Up Countdown (20m, 30m, 40m, 50m)
    if (action === 'start_wrap_up') {
      const minutes = Number(durationMinutes) || 20
      const endsAt = new Date(Date.now() + minutes * 60 * 1000).toISOString()

      currentSession.status = 'wrap_up'
      currentSession.wrapUpDurationMinutes = minutes
      currentSession.wrapUpEndsAt = endsAt

      await saveSession(currentSession)
      revalidatePath('/')
      revalidatePath('/sma')
      return NextResponse.json({ success: true, session: currentSession })
    }

    // ACTION: End Session
    if (action === 'end') {
      currentSession.status = 'ended'
      currentSession.endedAt = new Date().toISOString()
      await saveSession(currentSession)
      revalidatePath('/')
      revalidatePath('/sma')
      return NextResponse.json({ success: true, session: currentSession })
    }

    // ACTION: End & Publish Recap Transcript
    if (action === 'recap') {
      currentSession.status = 'ended'
      currentSession.endedAt = new Date().toISOString()

      const questions = await getQuestions(currentSession.id)
      const answeredQuestions = questions.filter(q => Boolean(q.reply))

      // Rank by net sentiment score
      const sortedBySentiment = [...answeredQuestions].sort((a, b) => (b.netSentiment || 0) - (a.netSentiment || 0))
      const topHighlights = sortedBySentiment.slice(0, 5)

      // 1. Generate permanent SEO-friendly Markdown post on Teleboros
      const recapPostId = `session-${currentSession.id}`
      const recapTitle = `Recap: ${currentSession.title}`
      const recapArticleUrl = `${siteUrl}/sessions/${currentSession.id}`

      const mdSections = [
        `# ${recapTitle}`,
        ``,
        `> **Live S.M.A Transcript & Highlights** — Recorded live on Teleboros.`,
        ``,
        `### Top Community Highlights`,
        ``,
      ]

      for (let i = 0; i < topHighlights.length; i++) {
        const q = topHighlights[i]
        const link = q.reply?.deepLink ? ` — [View in Telegram Discussion](${q.reply.deepLink})` : ''
        mdSections.push(`#### ${i + 1}. Inquiry by ${q.colorToken.badge} (Score: +${q.netSentiment})`)
        mdSections.push(`> "${q.text}"`)
        mdSections.push(``)
        mdSections.push(`**Response:**\n\n${q.reply?.text || ''}${link}`)
        mdSections.push(``)
      }

      if (answeredQuestions.length > topHighlights.length) {
        mdSections.push(`### All Answered Inquiries (${answeredQuestions.length} Total)`)
        mdSections.push(``)
        for (const q of answeredQuestions) {
          if (!topHighlights.includes(q)) {
            mdSections.push(`##### ${q.colorToken.badge}`)
            mdSections.push(`> "${q.text}"`)
            mdSections.push(`**Answer:** ${q.reply?.text || ''}`)
            mdSections.push(``)
          }
        }
      }

      const fullMarkdown = mdSections.join('\n')
      const condensedTeaser = `🏁 Live AMA recap is now live: "${currentSession.title}". Read the full highlights and answers from community members!`

      // Save as permanent Teleboros post
      try {
        await saveLongFormPost(recapPostId, fullMarkdown, condensedTeaser, recapTitle)
      }
      catch (e) {
        console.warn('[sma recap] Error saving long form transcript:', e)
      }

      currentSession.recapPostId = recapPostId
      currentSession.recapArticleUrl = recapArticleUrl
      await saveSession(currentSession)

      // 2. Broadcast formatted recap digest to Telegram Channel
      await broadcastSmaRecap(currentSession, topHighlights, recapArticleUrl)

      revalidatePath('/')
      revalidatePath('/sma')
      revalidatePath(`/sessions/${currentSession.id}`)

      return NextResponse.json({
        success: true,
        session: currentSession,
        recapPostId,
        recapArticleUrl,
        highlightsCount: topHighlights.length,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
  catch (err: any) {
    console.error('[sma session api] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
