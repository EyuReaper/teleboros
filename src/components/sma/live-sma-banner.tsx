'use client'

import type { SmaQuestion, SmaSession } from '@/lib/sma/types'
import { ArrowRight, Clock, MessageSquare, Radio, Sparkles } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

interface LiveSmaBannerProps {
  initialSession?: SmaSession | null
}

export function LiveSmaBanner({ initialSession }: LiveSmaBannerProps) {
  const [session, setSession] = useState<SmaSession | null>(initialSession || null)
  const [recentAnswered, setRecentAnswered] = useState<SmaQuestion[]>([])
  const [timeLeft, setTimeLeft] = useState<string | null>(null)

  // Poll for active session
  useEffect(() => {
    let mounted = true
    const checkActive = async () => {
      try {
        const res = await fetch('/api/sma/session')
        const data = await res.json()
        if (mounted) {
          if (data.session && (data.session.status === 'active' || data.session.status === 'wrap_up')) {
            setSession(data.session)
          }
          else {
            setSession(null)
          }
        }
      }
      catch {
        // Ignore
      }
    }

    if (!initialSession) {
      checkActive()
    }

    const interval = setInterval(checkActive, 20_000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [initialSession])

  // Fetch recent answered questions for the ticker
  useEffect(() => {
    if (!session) {
      return
    }

    let mounted = true
    const fetchRecent = async () => {
      try {
        const res = await fetch(`/api/sma?sessionId=${session.id}`)
        const data = await res.json()
        if (mounted && data.questions) {
          const answered = (data.questions as SmaQuestion[])
            .filter(q => q.status === 'answered' || Boolean(q.reply))
            .slice(-4)
            .reverse()
          setRecentAnswered(answered)
        }
      }
      catch {
        // Ignore
      }
    }

    fetchRecent()
    const timer = setInterval(fetchRecent, 25_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [session])

  // Countdown timer calculation
  useEffect(() => {
    if (!session || session.status !== 'wrap_up' || !session.wrapUpEndsAt) {
      setTimeLeft(null)
      return
    }

    const interval = setInterval(() => {
      const endsAt = new Date(session.wrapUpEndsAt!).getTime()
      const diff = endsAt - Date.now()

      if (diff <= 0) {
        setTimeLeft('00:00')
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

  if (!session || session.status === 'ended') {
    return null
  }

  const isWrapUp = session.status === 'wrap_up'

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-2 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 shadow-xl transition-all ${
        isWrapUp
          ? 'bg-gradient-to-br from-[#1c130b] via-[#15101a] to-[#090d16] border-amber-500/40 shadow-amber-500/5'
          : 'bg-gradient-to-br from-[#120e24] via-[#0d1127] to-[#090d16] border-purple-500/40 shadow-purple-500/5'
      }`}
      >
        {/* Ambient Top Glow */}
        <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl pointer-events-none opacity-20 ${
          isWrapUp ? 'bg-amber-500' : 'bg-purple-500'
        }`}
        />

        <div className="relative z-10 flex flex-col gap-3">
          {/* Top Row: Live Indicator & Countdown */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isWrapUp ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isWrapUp ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                />
              </span>
              <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${
                isWrapUp ? 'text-amber-400' : 'text-purple-300'
              }`}
              >
                {isWrapUp ? 'S.M.A Wrap-Up Phase' : 'Live S.M.A Active'}
              </span>
            </div>

            {timeLeft ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-semibold">
                <Clock className="w-3.5 h-3.5 animate-spin" />
                <span>Closing in {timeLeft}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Taking Inquiries</span>
              </div>
            )}
          </div>

          {/* Headline & Prompt */}
          <div>
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>{session.headline || 'Live S.M.A Session is active!'}</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 mt-0.5 leading-relaxed">
              {session.promptMessage || session.title}
            </p>
          </div>

          {/* Recent Answered Ticker */}
          {recentAnswered.length > 0 && (
            <div className="flex items-center gap-2 pt-1 overflow-x-auto no-scrollbar text-xs">
              <span className="text-[11px] text-slate-400 font-mono shrink-0">Recent:</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {recentAnswered.map(q => (
                  <Link
                    key={q.id}
                    href={`/posts/${session.id}/thread`}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-mono font-semibold hover:opacity-80 transition-opacity"
                    style={{
                      backgroundColor: q.colorToken.bgHex,
                      borderColor: q.colorToken.borderHex,
                      color: q.colorToken.textHex,
                    }}
                    title={`"${q.text}"`}
                  >
                    <span>● #{q.colorToken.tokenNumber}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center gap-2.5 pt-1">
            <Link
              href={`/sma/${session.id}`}
              className="flex-1 py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-white/10 transition-transform active:scale-[0.98]"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Ask Anonymously</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>

            <Link
              href={`/posts/${session.id}/thread`}
              className="py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Thread</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
