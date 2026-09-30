'use client'

import type { SmaColorToken, SmaSession, SmaSubmissionReceipt } from '@/lib/sma/types'
import { ArrowLeft, CheckCircle2, Clock, MessageSquare, Send, Sparkles } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useId, useState } from 'react'
import { deriveColorToken, generateClientSeed } from '@/lib/sma/tokens'

interface SmaPortalProps {
  initialSession: SmaSession | null
  sessionId?: string
  siteTitle?: string
}

export function SmaPortal({ initialSession, sessionId, siteTitle = 'Teleboros' }: SmaPortalProps) {
  const honeypotId = useId()
  const [session, setSession] = useState<SmaSession | null>(initialSession)
  const [text, setText] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<SmaSubmissionReceipt | null>(null)
  const [clientSeed, setClientSeed] = useState('')
  const [colorToken, setColorToken] = useState<SmaColorToken | null>(null)
  const [timeLeft, setTimeLeft] = useState<string | null>(null)
  const [isTelegramMiniApp, setIsTelegramMiniApp] = useState(false)

  // Initialize client seed & color token
  useEffect(() => {
    let seed = localStorage.getItem('teleboros_sma_seed')
    if (!seed) {
      seed = generateClientSeed()
      localStorage.setItem('teleboros_sma_seed', seed)
    }
    setClientSeed(seed)
    setColorToken(deriveColorToken(seed))
  }, [])

  // Detect Telegram Mini App SDK
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp
      setIsTelegramMiniApp(true)
      try {
        tg.ready?.()
        tg.expand?.()
      }
      catch (e) {
        console.warn('Telegram WebApp init error:', e)
      }
    }
  }, [])

  // Live countdown clock if wrap_up is active
  useEffect(() => {
    if (!session || session.status !== 'wrap_up' || !session.wrapUpEndsAt) {
      setTimeLeft(null)
      return
    }

    const interval = setInterval(() => {
      const endsAt = new Date(session.wrapUpEndsAt!).getTime()
      const now = Date.now()
      const diff = endsAt - now

      if (diff <= 0) {
        setTimeLeft('00:00 - Session Closing')
        clearInterval(interval)
      }
      else {
        const mins = Math.floor(diff / 60000)
        const secs = Math.floor((diff % 60000) / 1000)
        setTimeLeft(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [session])

  // Refresh session data
  const refreshSession = async () => {
    try {
      const res = await fetch(`/api/sma/session${sessionId ? `?id=${sessionId}` : ''}`)
      const data = await res.json()
      if (data.session) {
        setSession(data.session)
      }
    }
    catch {
      // Ignore
    }
  }

  useEffect(() => {
    const timer = setInterval(refreshSession, 15000)
    return () => clearInterval(timer)
  }, [sessionId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!text.trim()) {
      setError('Please enter your question or message.')
      return
    }

    if (text.trim().length < 5) {
      setError('Question must be at least 5 characters.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/sma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          sessionId: session?.id,
          seed: clientSeed,
          honeypot,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Failed to submit inquiry')
        setLoading(false)
        return
      }

      setReceipt(data.receipt)
      setText('')

      // Telegram Mini App Haptic Feedback
      if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
        try {
          (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success')
        }
        catch {
          // Ignore
        }
      }
    }
    catch (err: any) {
      setError(err.message || 'Network error occurred')
    }
    finally {
      setLoading(false)
    }
  }

  const handleResetForNewQuestion = () => {
    // Generate a fresh inquiry seed for new question
    const newSeed = generateClientSeed()
    localStorage.setItem('teleboros_sma_seed', newSeed)
    setClientSeed(newSeed)
    setColorToken(deriveColorToken(newSeed))
    setReceipt(null)
    setError(null)
  }

  const isSessionEnded = session?.status === 'ended'
  const isNoSession = !session

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between selection:bg-purple-500/30 selection:text-purple-200">
      {/* Top Header */}
      <header className="border-b border-white/10 backdrop-blur-md sticky top-0 z-30 bg-[#090d16]/80 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{siteTitle}</span>
          </Link>

          {session && (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${session.status === 'wrap_up' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${session.status === 'wrap_up' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              </span>
              <span className="text-xs uppercase tracking-wider font-mono font-semibold text-slate-300">
                {session.status === 'wrap_up' ? 'Wrap-Up Period' : 'Live AMA Active'}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Form Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-2xl mx-auto w-full">
        {/* Wrap-Up Countdown Banner */}
        {timeLeft && (
          <div className="w-full mb-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between text-xs sm:text-sm font-mono shadow-lg shadow-amber-500/5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 animate-spin" />
              <span>Wrap-Up Countdown:</span>
            </div>
            <span className="font-bold text-amber-200 text-sm">{timeLeft}</span>
          </div>
        )}

        {/* Successful Submission Receipt Screen */}
        {receipt ? (
          <div className="w-full bg-[#0f172a]/90 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Inquiry Transmitted</h2>
              <p className="text-sm text-slate-400">Your question is anonymous and received by the creator.</p>
            </div>

            {/* Cryptographic Color Badge Display */}
            <div
              className="p-5 rounded-xl border flex flex-col items-center gap-2"
              style={{
                backgroundColor: receipt.colorToken.bgHex,
                borderColor: receipt.colorToken.borderHex,
                boxShadow: `0 0 30px ${receipt.colorToken.hex}22`,
              }}
            >
              <span className="text-xs uppercase tracking-widest font-mono text-slate-300">Your Unique Token Badge</span>
              <div
                className="text-lg sm:text-xl font-bold font-mono tracking-wide"
                style={{ color: receipt.colorToken.textHex }}
              >
                {receipt.colorToken.badge}
              </div>
              <p className="text-xs text-slate-300/80 max-w-sm">
                Watch for this token in the Telegram comments thread or live stream to identify when your question is answered!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Link
                href={`/posts/${receipt.sessionId}/thread`}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-medium text-sm flex items-center justify-center gap-2 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Open Live Discussion Thread</span>
              </Link>
              <button
                type="button"
                onClick={handleResetForNewQuestion}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-all shadow-lg shadow-purple-600/20"
              >
                Ask Another Question
              </button>
            </div>
          </div>
        ) : isNoSession || isSessionEnded ? (
          <div className="w-full bg-[#0f172a]/90 border border-white/10 rounded-2xl p-8 backdrop-blur shadow-2xl text-center space-y-4">
            <h2 className="text-xl font-bold text-white">No Live S.M.A Session Active</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              There is currently no ongoing Ask Me Anything session accepting inquiries. Follow the channel to be alerted when the next live session starts.
            </p>
            <Link
              href="/"
              className="inline-block mt-4 py-2.5 px-5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-medium text-white transition-colors"
            >
              Return to Feed
            </Link>
          </div>
        ) : (
          /* Live Inquiry Form */
          <div className="w-full bg-[#0f172a]/80 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur shadow-2xl space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-mono tracking-widest text-purple-400 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Send Messages Anon</span>
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {session?.title || 'Ask Me Anything'}
              </h1>
              {session?.promptMessage && (
                <p className="text-sm text-slate-300 leading-relaxed italic border-l-2 border-purple-500/50 pl-3 py-0.5">
                  &ldquo;{session.promptMessage}&rdquo;
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Invisible Honeypot input */}
              <input
                id={honeypotId}
                type="text"
                name="website_url"
                value={honeypot}
                onChange={e => setHoneypot(e.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <label htmlFor="questionText" className="font-medium">Your Anonymous Question:</label>
                  <span>{text.length}/1000</span>
                </div>
                <textarea
                  id="questionText"
                  rows={4}
                  maxLength={1000}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Ask anything freely... Thoughts, technical queries, or unfiltered ideas."
                  className="w-full bg-black/40 border border-white/10 focus:border-purple-500 rounded-xl p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none transition-all"
                  required
                />
              </div>

              {/* Cryptographic Token Preview Badge */}
              {colorToken && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <span className="text-slate-400">Cryptographic Identity Badge:</span>
                  <div
                    className="font-mono font-bold px-2.5 py-1 rounded-full text-xs border"
                    style={{
                      backgroundColor: colorToken.bgHex,
                      borderColor: colorToken.borderHex,
                      color: colorToken.textHex,
                    }}
                  >
                    {colorToken.badge}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !text.trim()}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
              >
                {loading ? (
                  <span>Transmitting...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Anonymously</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center">
              <p className="text-[11px] text-slate-500">
                100% private & anonymous. No IP addresses or identifying telemetry stored.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-4 px-4 text-center text-xs text-slate-500">
        <span>Powered by Teleboros S.M.A Engine</span>
      </footer>
    </div>
  )
}
