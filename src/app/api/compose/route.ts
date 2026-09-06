import process from 'node:process'
import { NextResponse } from 'next/server'
import { SITE_CONSTANTS } from '@/lib/constant'
import { saveLongFormPost } from '@/lib/long-form'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const title = formData.get('title') as string | null
    const text = formData.get('text') as string
    const adminToken = formData.get('adminToken') as string
    const image = formData.get('image') as File | null
    const video = formData.get('video') as File | null
    const media = formData.get('media') as File | null

    const videoFile = video || (media && (media.type.startsWith('video/') || /\.(?:mp4|mov|webm|mkv|avi|m4v)$/i.test(media.name)) ? media : null)
    const imageFile = image || (media && !videoFile ? media : null)
    const hasMedia = Boolean(videoFile || imageFile)

    // 1. Verify Admin Token
    const envAdminToken = process.env.ADMIN_TOKEN
    if (!envAdminToken || adminToken !== envAdminToken) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Admin Token' }, { status: 401 })
    }

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    // 2. AI Condensation via Gemini
    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 })
    }

    const condensationPrompt = hasMedia
      ? `Condense the following text into an engaging summary teaser for a Telegram video/photo post (strictly UNDER 800 characters so there is room for formatting and links). Use Telegram HTML formatting (like <b>bold</b> or <i>italic</i>) if appropriate:\n\n${text}`
      : `Condense the following text for a Telegram post while keeping the main points and making it engaging. Use Telegram HTML formatting (like <b>bold</b> or <i>italic</i>) if appropriate:\n\n${text}`

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: condensationPrompt },
            ],
          },
        ],
      }),
    })

    if (!geminiRes.ok) {
      const errorData = await geminiRes.text()
      console.error('Gemini error:', errorData)
      return NextResponse.json({ error: 'Failed to condense text with Gemini' }, { status: 500 })
    }

    const geminiData = await geminiRes.json()
    const condensedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || text

    // 3. Post to Telegram
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN
    const telegramChatId = process.env.TELEGRAM_CHAT_ID

    if (!telegramBotToken || !telegramChatId) {
      return NextResponse.json({ error: 'Telegram credentials are not configured' }, { status: 500 })
    }

    let telegramRes
    if (videoFile) {
      // sendVideo
      const tgFormData = new FormData()
      tgFormData.append('chat_id', telegramChatId)
      tgFormData.append('caption', condensedText)
      tgFormData.append('parse_mode', 'HTML')
      tgFormData.append('supports_streaming', 'true')
      tgFormData.append('video', videoFile)

      telegramRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendVideo`, {
        method: 'POST',
        body: tgFormData,
      })
    }
    else if (imageFile) {
      // sendPhoto
      const tgFormData = new FormData()
      tgFormData.append('chat_id', telegramChatId)
      tgFormData.append('caption', condensedText)
      tgFormData.append('parse_mode', 'HTML')
      tgFormData.append('photo', imageFile)

      telegramRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendPhoto`, {
        method: 'POST',
        body: tgFormData,
      })
    }
    else {
      // sendMessage
      telegramRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: condensedText,
          parse_mode: 'HTML',
        }),
      })
    }

    if (!telegramRes.ok) {
      const errorData = await telegramRes.text()
      console.error('Telegram error:', errorData)
      return NextResponse.json({ error: 'Failed to post to Telegram' }, { status: 500 })
    }

    const telegramData = await telegramRes.json()
    const messageId = String(telegramData?.result?.message_id || '')

    // 4. Correlate and store the full-length long-form post, then append backlink to Telegram
    let postUrl = ''
    if (messageId) {
      await saveLongFormPost(messageId, text, condensedText, title || undefined)

      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || SITE_CONSTANTS.siteUrl || 'https://example.com').replace(/\/+$/, '')
      postUrl = `${siteUrl}/posts/${messageId}`
      const backlinkHtml = `\n\n📖 <a href="${postUrl}">Read full article on Teleboros</a>`
      const textWithBacklink = `${condensedText}${backlinkHtml}`

      // Edit the Telegram message to append the backlink
      try {
        if (hasMedia) {
          await fetch(`https://api.telegram.org/bot${telegramBotToken}/editMessageCaption`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramChatId,
              message_id: messageId,
              caption: textWithBacklink,
              parse_mode: 'HTML',
            }),
          })
        }
        else {
          await fetch(`https://api.telegram.org/bot${telegramBotToken}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramChatId,
              message_id: messageId,
              text: textWithBacklink,
              parse_mode: 'HTML',
            }),
          })
        }
      }
      catch (editError) {
        console.warn('Failed to edit Telegram message with backlink:', editError)
      }
    }

    // 5. Trigger Deploy Hook
    const deployHookUrl = process.env.DEPLOY_HOOK_URL
    if (deployHookUrl) {
      try {
        await fetch(deployHookUrl, { method: 'POST' })
      }
      catch (e) {
        console.error('Failed to trigger deploy hook:', e)
      }
    }

    return NextResponse.json({ success: true, messageId, postUrl, condensedText })
  }
  catch (error: any) {
    console.error('Compose API error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
