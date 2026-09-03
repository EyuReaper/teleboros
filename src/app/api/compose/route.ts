import process from 'node:process'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const text = formData.get('text') as string
    const adminToken = formData.get('adminToken') as string
    const image = formData.get('image') as File | null

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

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `Condense the following text for a Telegram post while keeping the main points and making it engaging. Use Telegram HTML formatting (like <b>bold</b> or <i>italic</i>) if appropriate:\n\n${text}` },
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
    if (image) {
      // sendPhoto
      const tgFormData = new FormData()
      tgFormData.append('chat_id', telegramChatId)
      tgFormData.append('caption', condensedText)
      tgFormData.append('parse_mode', 'HTML')
      // Node.js fetch supports passing a File/Blob inside FormData
      tgFormData.append('photo', image)

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

    // 4. Trigger Deploy Hook
    const deployHookUrl = process.env.DEPLOY_HOOK_URL
    if (deployHookUrl) {
      try {
        await fetch(deployHookUrl, { method: 'POST' })
      }
      catch (e) {
        console.error('Failed to trigger deploy hook:', e)
        // We don't fail the request if the deploy hook fails
      }
    }

    return NextResponse.json({ success: true, condensedText })
  }
  catch (error: any) {
    console.error('Compose API error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
