import process from 'node:process'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { questionText, contextTitle, adminToken } = await req.json()

    const envAdminToken = process.env.ADMIN_TOKEN
    if (!envAdminToken || adminToken !== envAdminToken) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Admin Token' }, { status: 401 })
    }

    if (!questionText?.trim()) {
      return NextResponse.json({ error: 'Question text is required' }, { status: 400 })
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json({
        success: true,
        draft: `Thank you for asking! Regarding "${questionText}": this is a thoughtful question. Here is my initial take: ...`,
      })
    }

    const prompt = `You are a helpful, articulate, and insightful technical creator/writer answering an anonymous community question in an AMA (Ask Me Anything) session.
Session Topic: ${contextTitle || 'Engineering, Technology, & Life'}
Anonymous Question: "${questionText}"

Write a concise, high-value, authentic, and engaging draft answer in 2-4 sentences or a short bulleted breakdown that the creator can review and polish. Be direct, authentic, and avoid generic fluff:`

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    })

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.warn('[sma ai-draft] Gemini API failed:', errText)
      return NextResponse.json({
        success: true,
        draft: `Regarding "${questionText}": Great inquiry. My perspective is that ...`,
      })
    }

    const geminiData = await geminiRes.json()
    const draft = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      || `Regarding "${questionText}": My perspective is that ...`

    return NextResponse.json({ success: true, draft })
  }
  catch (err: any) {
    console.error('[sma ai-draft] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
