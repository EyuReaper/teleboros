'use client'

import type { SmaQuestion, SmaSession } from '@/lib/sma/types'
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Flame,
  Heart,
  Lightbulb,
  MessageSquare,
  Radio,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

interface ThreadViewProps {
  session: SmaSession
  initialQuestions: SmaQuestion[]
  channelTitle?: string
  channelAvatar?: string
}

export function ThreadView({
  session,
  initialQuestions,
  channelTitle = 'Teleboros',
  channelAvatar = '/logo.png',
}: ThreadViewProps) {
  const [questions, setQuestions] = useState<SmaQuestion[]>(initialQuestions)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [reactingMap, setReactingMap] = useState<Record<string, boolean>>({})

  // Filter to answered questions (with replies)
  const answeredQuestions = questions.filter(q => Boolean(q.reply))

  // Live polling for new answers / reaction updates
  useEffect(() => {
    let mounted = true
    const poll = async () => {
      try {
        const res = await fetch(`/api/sma?sessionId=${session.id}`)
        const data = await res.json()
        if (mounted && data.questions) {
          setQuestions(data.questions)
        }
      }
      catch {
        // Ignore
      }
    }

    const interval = setInterval(poll, 12000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [session.id])

  const handleCopyLink = (q: SmaQuestion) => {
    const url = q.reply?.deepLink || (typeof window !== 'undefined' ? `${window.location.origin}/posts/${session.id}/thread#${q.id}` : '')
    if (url && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(url)
      setCopiedId(q.id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const handleReaction = async (questionId: string, emoji: '👍' | '👎' | '❤️' | '🔥' | '💡') => {
    if (reactingMap[`${questionId}-${emoji}`]) {
      return
    }

    setReactingMap(prev => ({ ...prev, [`${questionId}-${emoji}`]: true }))

    // Optimistically update
    setQuestions(prev => prev.map((q) => {
      if (q.id === questionId) {
        const reactions = { ...(q.reactions || { '👍': 0, '👎': 0, '❤️': 0, '🔥': 0, '💡': 0 }) }
        reactions[emoji] = (reactions[emoji] || 0) + 1
        const pos = (reactions['👍'] || 0) + (reactions['❤️'] || 0) + (reactions['🔥'] || 0) + (reactions['💡'] || 0)
        const neg = reactions['👎'] || 0
        return { ...q, reactions, netSentiment: pos - neg }
      }
      return q
    }))

    try {
      await fetch('/api/sma/reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, emoji }),
      })
    }
    catch (err) {
      console.error('Reaction failed:', err)
    }
    finally {
      setReactingMap(prev => ({ ...prev, [`${questionId}-${emoji}`]: false }))
    }
  }

  const isLive = session.status === 'active' || session.status === 'wrap_up'

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between selection:bg-purple-500/30 selection:text-purple-200">
      {/* Top Header */}
      <header className="border-b border-white/10 backdrop-blur-md sticky top-0 z-30 bg-[#090d16]/80 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Feed</span>
          </Link>

          <div className="flex items-center gap-3">
            {isLive ? (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs uppercase tracking-wider font-mono font-semibold text-emerald-400">
                  Live S.M.A
                </span>
              </div>
            ) : (
              <span className="text-xs uppercase tracking-wider font-mono font-semibold text-slate-400">
                Session Concluded
              </span>
            )}

            {isLive && (
              <Link
                href={`/sma/${session.id}`}
                className="py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/20"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ask Question</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">
        {/* Session Header Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#13112c] via-[#0f152d] to-[#090d16] border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-widest text-purple-400">
              <MessageSquare className="w-4 h-4" />
              <span>Discussion Thread & Transcript</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              {session.title}
            </h1>

            {session.promptMessage && (
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed italic border-l-2 border-purple-500/60 pl-3">
                &ldquo;{session.promptMessage}&rdquo;
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-3 text-xs text-slate-400 font-mono">
              <div className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span>{answeredQuestions.length} Answered Inquiries</span>
              </div>
              <div>•</div>
              <div>Started {new Date(session.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        {/* Q&A Thread Branching List */}
        {answeredQuestions.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-[#0f172a]/60 border border-white/10 space-y-4">
            <MessageSquare className="w-8 h-8 text-slate-500 mx-auto" />
            <h3 className="text-lg font-bold text-white">No answered questions yet</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              {isLive
                ? 'Questions submitted by readers are being triaged and answered. Be the first to ask!'
                : 'This session has no recorded Q&As.'}
            </p>
            {isLive && (
              <Link
                href={`/sma/${session.id}`}
                className="inline-block py-2.5 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/20"
              >
                Send Anonymous Question
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {answeredQuestions.map((q, idx) => {
              const borderAccent = q.colorToken.hex || '#a855f7'
              return (
                <div
                  key={q.id}
                  id={q.id}
                  className="group relative transition-all scroll-mt-20"
                >
                  {/* Question Card */}
                  <div
                    className="p-5 sm:p-6 rounded-2xl border backdrop-blur transition-all shadow-lg"
                    style={{
                      backgroundColor: '#0d1322',
                      borderColor: q.colorToken.borderHex,
                      boxShadow: `0 0 25px ${q.colorToken.hex}15`,
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="px-2.5 py-1 rounded-full text-xs font-mono font-bold border"
                          style={{
                            backgroundColor: q.colorToken.bgHex,
                            borderColor: q.colorToken.borderHex,
                            color: q.colorToken.textHex,
                          }}
                        >
                          {q.colorToken.badge}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Inquiry #{idx + 1}
                        </span>
                      </div>

                      <span className="text-xs text-slate-500">
                        {new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed">
                      &ldquo;{q.text}&rdquo;
                    </p>
                  </div>

                  {/* Reddit-Style Branching Connector Stem */}
                  <div className="relative pl-6 sm:pl-10 pt-3">
                    {/* Vertical Connector Line */}
                    <div
                      className="absolute left-4 sm:left-6 top-0 bottom-6 w-0.5 pointer-events-none"
                      style={{
                        backgroundColor: borderAccent,
                        opacity: 0.5,
                      }}
                    />

                    {/* Horizontal Branching Elbow Curve */}
                    <div
                      className="absolute left-4 sm:left-6 top-6 w-4 sm:w-6 h-6 border-b-2 border-l-2 rounded-bl-xl pointer-events-none"
                      style={{
                        borderColor: borderAccent,
                        opacity: 0.5,
                      }}
                    />

                    {/* Creator's Reply Card */}
                    <div className="p-5 sm:p-6 rounded-2xl bg-[#0f172a]/90 border border-white/10 shadow-xl space-y-4">
                      {/* Creator Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <Image
                            src={channelAvatar}
                            alt={channelTitle}
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full border border-white/10 object-cover"
                          />
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>{channelTitle}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-normal">
                                Creator
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {q.reply?.createdAt ? new Date(q.reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                          </div>
                        </div>

                        {/* Direct Deep Links */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(q)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white text-xs transition-colors cursor-pointer"
                            title="Copy Direct Deep Link"
                          >
                            {copiedId === q.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {q.reply?.deepLink && (
                            <Link
                              href={q.reply.deepLink}
                              target="_blank"
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-sky-400 text-xs transition-colors"
                              title="View comment on Telegram"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Reply Text */}
                      <div className="text-sm sm:text-base text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {q.reply?.text}
                      </div>

                      {/* Community Reactions Bar with Net Sentiment Score */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleReaction(q.id, '👍')}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          >
                            <span>👍</span>
                            <span>{q.reactions?.['👍'] || 0}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReaction(q.id, '❤️')}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <span>❤️</span>
                            <span>{q.reactions?.['❤️'] || 0}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReaction(q.id, '🔥')}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
                          >
                            <span>🔥</span>
                            <span>{q.reactions?.['🔥'] || 0}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReaction(q.id, '💡')}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-yellow-400 transition-colors cursor-pointer"
                          >
                            <span>💡</span>
                            <span>{q.reactions?.['💡'] || 0}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReaction(q.id, '👎')}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                            title="Downvote"
                          >
                            <span>👎</span>
                            <span>{q.reactions?.['👎'] || 0}</span>
                          </button>
                        </div>

                        {/* Net Sentiment Badge */}
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full font-mono font-semibold text-[11px] ${
                            (q.netSentiment || 0) >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}
                          >
                            Net Score: {(q.netSentiment || 0) > 0 ? `+${q.netSentiment}` : q.netSentiment || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 px-4 text-center text-xs text-slate-500">
        <span>Powered by Teleboros Live S.M.A Engine</span>
      </footer>
    </div>
  )
}
