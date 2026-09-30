'use client'

import type { SmaEventPayload, SmaQuestion, SmaSession } from '@/lib/sma/types'
import {
  AlertCircle,
  Archive,
  Award,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  Play,
  Radio,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

export function RmaStudio() {
  const [adminToken, setAdminToken] = useState('')
  const [session, setSession] = useState<SmaSession | null>(null)
  const [questions, setQuestions] = useState<SmaQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'queued' | 'answered' | 'dismissed'>('all')

  // New Session form fields
  const [newTitle, setNewTitle] = useState('')
  const [newHeadline, setNewHeadline] = useState('')
  const [newPrompt, setNewPrompt] = useState('')

  // Banner edit fields
  const [editHeadline, setEditHeadline] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [bannerSaveStatus, setBannerSaveStatus] = useState<string | null>(null)

  // Reply state for currently answering question
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  const [aiDraftLoading, setAiDraftLoading] = useState(false)

  // Recap state
  const [recapPublishing, setRecapPublishing] = useState(false)
  const [recapResult, setRecapResult] = useState<any>(null)

  // Wrap up timer
  const [wrapUpDuration, setWrapUpDuration] = useState<number>(20)
  const [timeLeft, setTimeLeft] = useState<string | null>(null)

  // Load admin token from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('teleboros_admin_token')
    if (savedToken) {
      setAdminToken(savedToken)
    }
  }, [])

  const handleSaveToken = (token: string) => {
    setAdminToken(token)
    localStorage.setItem('teleboros_admin_token', token)
  }

  // Fetch active session and its questions
  const fetchSessionAndQuestions = async () => {
    try {
      const res = await fetch('/api/sma/session')
      const data = await res.json()
      if (data.session) {
        setSession(data.session)
        setEditHeadline(data.session.headline || '')
        setEditPrompt(data.session.promptMessage || '')

        const qRes = await fetch(`/api/sma?sessionId=${data.session.id}`)
        const qData = await qRes.json()
        if (qData.questions) {
          setQuestions(qData.questions)
        }
      }
      else {
        setSession(null)
        setQuestions([])
      }
    }
    catch (err) {
      console.error('Failed to fetch session:', err)
    }
  }

  useEffect(() => {
    fetchSessionAndQuestions()
  }, [])

  // Server-Sent Events (SSE) listener for real-time updates
  useEffect(() => {
    if (!session?.id) {
      return
    }

    const eventSource = new EventSource(`/api/sma/events?sessionId=${session.id}`)

    eventSource.onmessage = (e) => {
      try {
        const payload: SmaEventPayload = JSON.parse(e.data)

        if (payload.type === 'question_created' && payload.question) {
          setQuestions(prev => [payload.question!, ...prev.filter(q => q.id !== payload.question!.id)])
        }
        else if ((payload.type === 'question_updated' || payload.type === 'reaction_updated') && payload.question) {
          setQuestions(prev => prev.map(q => q.id === payload.question!.id ? payload.question! : q))
        }
        else if (payload.type === 'session_updated' && payload.session) {
          setSession(payload.session)
        }
      }
      catch (err) {
        console.warn('Failed to parse SSE payload:', err)
      }
    }

    return () => {
      eventSource.close()
    }
  }, [session?.id])

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

  // Create new session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminToken) {
      alert('Admin token required')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/sma/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          adminToken,
          title: newTitle || 'Live Ask Me Anything',
          headline: newHeadline || 'Live S.M.A Session is active!',
          promptMessage: newPrompt || 'Ask anything anonymously.',
        }),
      })

      const data = await res.json()
      if (data.session) {
        setSession(data.session)
        setQuestions([])
        setEditHeadline(data.session.headline || '')
        setEditPrompt(data.session.promptMessage || '')
      }
      else if (data.error) {
        alert(data.error)
      }
    }
    catch (err: any) {
      alert(err.message)
    }
    finally {
      setLoading(false)
    }
  }

  // Update homepage live banner
  const handleSaveBanner = async () => {
    if (!session || !adminToken) {
      return
    }
    try {
      const res = await fetch('/api/sma/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_banner',
          sessionId: session.id,
          adminToken,
          headline: editHeadline,
          promptMessage: editPrompt,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setBannerSaveStatus('Saved!')
        setTimeout(() => setBannerSaveStatus(null), 2500)
      }
    }
    catch (err) {
      console.error(err)
    }
  }

  // Trigger on-demand wrap-up countdown preset
  const handleStartWrapUp = async (minutes: number) => {
    if (!session || !adminToken) {
      return
    }
    try {
      const res = await fetch('/api/sma/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_wrap_up',
          sessionId: session.id,
          durationMinutes: minutes,
          adminToken,
        }),
      })
      const data = await res.json()
      if (data.session) {
        setSession(data.session)
      }
    }
    catch (err) {
      console.error(err)
    }
  }

  // Triage actions (toggle star, dismiss, restore)
  const handleTriage = async (questionId: string, action: 'toggle_star' | 'dismiss' | 'restore') => {
    if (!adminToken) {
      return
    }
    try {
      const res = await fetch('/api/sma/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          questionId,
          adminToken,
        }),
      })
      const data = await res.json()
      if (data.question) {
        setQuestions(prev => prev.map(q => q.id === questionId ? data.question : q))
      }
    }
    catch (err) {
      console.error(err)
    }
  }

  // AI draft assistant
  const handleAiDraft = async (question: SmaQuestion) => {
    if (!adminToken) {
      return
    }
    setAiDraftLoading(true)
    try {
      const res = await fetch('/api/sma/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: question.text,
          contextTitle: session?.title,
          adminToken,
        }),
      })
      const data = await res.json()
      if (data.draft) {
        setReplyText(data.draft)
        setSelectedQuestionId(question.id)
      }
    }
    catch (err) {
      console.error(err)
    }
    finally {
      setAiDraftLoading(false)
    }
  }

  // Post Answer to Telegram discussion thread
  const handlePostReply = async (questionId: string) => {
    if (!adminToken || !replyText.trim()) {
      return
    }
    setReplyLoading(true)
    try {
      const res = await fetch('/api/sma/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reply',
          questionId,
          replyText: replyText.trim(),
          adminToken,
        }),
      })
      const data = await res.json()
      if (data.question) {
        setQuestions(prev => prev.map(q => q.id === questionId ? data.question : q))
        setReplyText('')
        setSelectedQuestionId(null)
      }
      else if (data.error) {
        alert(data.error)
      }
    }
    catch (err: any) {
      alert(err.message)
    }
    finally {
      setReplyLoading(false)
    }
  }

  // End Session & Publish Recap
  const handlePublishRecap = async () => {
    if (!session || !adminToken) {
      return
    }
    if (!confirm('End this S.M.A session and publish the recap digest to Telegram and permanent Teleboros transcript?')) {
      return
    }

    setRecapPublishing(true)
    try {
      const res = await fetch('/api/sma/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recap',
          sessionId: session.id,
          adminToken,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSession(data.session)
        setRecapResult(data)
      }
      else {
        alert(data.error || 'Failed to publish recap')
      }
    }
    catch (err: any) {
      alert(err.message)
    }
    finally {
      setRecapPublishing(false)
    }
  }

  const filteredQuestions = questions.filter((q) => {
    if (activeTab === 'queued') {
      return q.status === 'queued' || q.isStarred
    }
    if (activeTab === 'answered') {
      return q.status === 'answered' || Boolean(q.reply)
    }
    if (activeTab === 'dismissed') {
      return q.status === 'dismissed'
    }
    return q.status !== 'dismissed' // 'all' excludes dismissed
  })

  return (
    <div className="space-y-6">
      {/* Admin Token Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin Authentication</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={adminToken}
            onChange={e => handleSaveToken(e.target.value)}
            placeholder="Enter ADMIN_TOKEN"
            className="px-3 py-1.5 rounded-lg bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 w-48 sm:w-56"
          />
          <button
            type="button"
            onClick={fetchSessionAndQuestions}
            className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs"
            title="Refresh state"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Recap Success Banner */}
      {recapResult && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="font-bold text-white">Session Concluded & Recap Published!</div>
              <div>Highlights broadcasted to Telegram and mirrored to permanent transcript.</div>
            </div>
          </div>
          {recapResult.recapArticleUrl && (
            <Link
              href={recapResult.recapArticleUrl}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <span>View Transcript</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}

      {/* Session Controller Panel */}
      {session && session.status !== 'ended' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Status & Lifecycle Card */}
          <div className="lg:col-span-2 p-5 rounded-2xl bg-card border border-border space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    session.status === 'wrap_up' ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  />
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${
                    session.status === 'wrap_up' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  />
                </span>
                <h2 className="text-lg font-bold tracking-tight">{session.title}</h2>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {timeLeft ? (
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3 animate-spin" />
                    <span>Wrap-Up: {timeLeft}</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold">
                    INDEFINITE ACTIVE
                  </span>
                )}

                <Link
                  href={`/posts/${session.id}/thread`}
                  target="_blank"
                  className="px-2.5 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-medium flex items-center gap-1"
                >
                  <span>Thread</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Wrap-up Duration Presets */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">On-Demand Wrap-Up Timer:</span>
                <span className="text-muted-foreground">Trigger closing countdown window</span>
              </div>
              <div className="flex items-center gap-2">
                {[20, 30, 40, 50].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleStartWrapUp(mins)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-background hover:bg-amber-500/10 hover:border-amber-500/30 border border-border text-xs font-mono font-medium transition-colors cursor-pointer"
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* End & Publish Recap Action */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">Conclude session and post editorial recap:</span>
              <button
                type="button"
                onClick={handlePublishRecap}
                disabled={recapPublishing}
                className="py-2 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                <Award className="w-3.5 h-3.5" />
                <span>{recapPublishing ? 'Publishing Recap...' : 'End Session & Publish Recap'}</span>
              </button>
            </div>
          </div>

          {/* Homepage Live Banner Customizer */}
          <div className="p-5 rounded-2xl bg-card border border-border space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Feed Banner Customizer</h3>
                {bannerSaveStatus && <span className="text-xs text-emerald-400 font-semibold">{bannerSaveStatus}</span>}
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground">Banner Headline:</label>
                <input
                  type="text"
                  value={editHeadline}
                  onChange={e => setEditHeadline(e.target.value)}
                  placeholder="e.g. Live S.M.A Session is active!"
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground">Prompt Message:</label>
                <textarea
                  rows={2}
                  value={editPrompt}
                  onChange={e => setEditPrompt(e.target.value)}
                  placeholder="e.g. Drop your anonymous questions..."
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveBanner}
              className="w-full py-2 px-3 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-colors cursor-pointer"
            >
              Update Homepage Banner
            </button>
          </div>
        </div>
      ) : (
        /* Create New RMA Session Card */
        <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold">Launch New Live S.M.A Session</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Starting a session activates the live feed banner, broadcasts an announcement to your Telegram channel with web/Mini App links, and captures questions anonymously.
          </p>

          <form onSubmit={handleCreateSession} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Session Title:</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Ask Me Anything: Architecture & Open Source"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Homepage Headline:</label>
                <input
                  type="text"
                  value={newHeadline}
                  onChange={e => setNewHeadline(e.target.value)}
                  placeholder="e.g. Live S.M.A Session is active!"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Audience Prompt:</label>
              <textarea
                rows={2}
                value={newPrompt}
                onChange={e => setNewPrompt(e.target.value)}
                placeholder="e.g. Drop your thoughts, technical queries, or unfiltered ideas."
                className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !newTitle.trim()}
              className="py-2.5 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-purple-600/20 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{loading ? 'Launching Session...' : 'Start Live Session & Broadcast to Telegram'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Real-time Incoming Question Stream & Triage */}
      {session && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <h3 className="font-bold text-sm">
                Incoming Question Stream ({questions.length} total)
              </h3>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-muted text-xs">
              {(['all', 'queued', 'answered', 'dismissed'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded-lg font-medium capitalize transition-all cursor-pointer ${
                    activeTab === tab
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {filteredQuestions.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-card border border-border text-muted-foreground text-xs">
              No questions found in this tab yet. Questions submitted by the audience will stream in here live.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredQuestions.map(q => (
                <div
                  key={q.id}
                  className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-3 transition-all hover:border-border/80"
                  style={{
                    borderLeftWidth: '4px',
                    borderLeftColor: q.colorToken.hex,
                  }}
                >
                  {/* Card Header: Color Badge & Sentiment */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border"
                        style={{
                          backgroundColor: q.colorToken.bgHex,
                          borderColor: q.colorToken.borderHex,
                          color: q.colorToken.textHex,
                        }}
                      >
                        {q.colorToken.badge}
                      </span>

                      <span className="text-[11px] text-muted-foreground">
                        {new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Net Sentiment Badge */}
                      <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-semibold ${
                        (q.netSentiment || 0) >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}
                      >
                        Net Score: {(q.netSentiment || 0) > 0 ? `+${q.netSentiment}` : q.netSentiment || 0}
                      </span>

                      {/* Triage buttons */}
                      <button
                        type="button"
                        onClick={() => handleTriage(q.id, 'toggle_star')}
                        className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                          q.isStarred
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                            : 'bg-muted/60 border-border text-muted-foreground hover:text-foreground'
                        }`}
                        title={q.isStarred ? 'Unstar / De-queue' : 'Star / Queue Question'}
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                      </button>

                      {q.status === 'dismissed' ? (
                        <button
                          type="button"
                          onClick={() => handleTriage(q.id, 'restore')}
                          className="p-1.5 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                          title="Restore"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleTriage(q.id, 'dismiss')}
                          className="p-1.5 rounded-lg bg-muted/60 hover:bg-rose-500/10 hover:border-rose-500/30 border border-border text-muted-foreground hover:text-rose-400 text-xs cursor-pointer"
                          title="Dismiss question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Question Body */}
                  <div className="text-sm font-medium text-foreground leading-relaxed">
                    &ldquo;{q.text}&rdquo;
                  </div>

                  {/* Existing Answer or Reply Composer */}
                  {q.reply ? (
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-semibold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Answer Dispatched</span>
                        </span>
                        {q.reply.deepLink && (
                          <Link
                            href={q.reply.deepLink}
                            target="_blank"
                            className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
                          >
                            <span>Telegram Comment</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                      <p className="text-foreground leading-relaxed">{q.reply.text}</p>
                    </div>
                  ) : (
                    <div className="pt-2 space-y-2">
                      {selectedQuestionId === q.id ? (
                        <div className="space-y-2">
                          <textarea
                            rows={3}
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            placeholder="Type your response to post into the Telegram discussion thread..."
                            className="w-full p-3 rounded-xl bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                          />
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setSelectedQuestionId(null)}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Cancel
                            </button>

                            <button
                              type="button"
                              onClick={() => handlePostReply(q.id)}
                              disabled={replyLoading || !replyText.trim()}
                              className="py-1.5 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{replyLoading ? 'Dispatching...' : 'Post Answer to Thread'}</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedQuestionId(q.id)
                              setReplyText('')
                            }}
                            className="py-1.5 px-3 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                            <span>Answer Question</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAiDraft(q)}
                            disabled={aiDraftLoading}
                            className="py-1.5 px-3 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Bot className="w-3.5 h-3.5 text-purple-400" />
                            <span>AI Draft Assistant</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
