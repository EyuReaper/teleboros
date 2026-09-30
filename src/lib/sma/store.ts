import type { SmaEventPayload, SmaQuestion, SmaReactionCounts, SmaSession } from './types'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { getStorageAdapter } from '@/lib/storage'

const SMA_DIR = path.resolve(process.cwd(), 'data/sma')
const SESSIONS_FILE = path.join(SMA_DIR, 'sessions.json')
const QUESTIONS_FILE = path.join(SMA_DIR, 'questions.json')

// In-memory cache
let sessionsCache: SmaSession[] | null = null
let questionsCache: SmaQuestion[] | null = null

// Real-time Event Subscribers (SSE)
type SmaEventListener = (event: SmaEventPayload) => void
const eventListeners = new Set<SmaEventListener>()

export function subscribeSmaEvents(listener: SmaEventListener): () => void {
  eventListeners.add(listener)
  return () => {
    eventListeners.delete(listener)
  }
}

export function broadcastSmaEvent(event: SmaEventPayload): void {
  for (const listener of eventListeners) {
    try {
      listener(event)
    }
    catch (err) {
      console.error('[sma] Failed to dispatch event to listener:', err)
    }
  }
}

async function ensureDataFiles(): Promise<void> {
  try {
    await fs.mkdir(SMA_DIR, { recursive: true })
    try {
      await fs.access(SESSIONS_FILE)
    }
    catch {
      await fs.writeFile(SESSIONS_FILE, JSON.stringify([], null, 2), 'utf-8')
    }
    try {
      await fs.access(QUESTIONS_FILE)
    }
    catch {
      await fs.writeFile(QUESTIONS_FILE, JSON.stringify([], null, 2), 'utf-8')
    }
  }
  catch (err) {
    console.warn('[sma] Unable to create local data files:', err)
  }
}

export async function getSessions(): Promise<SmaSession[]> {
  if (sessionsCache) {
    return [...sessionsCache]
  }

  await ensureDataFiles()
  try {
    const raw = await fs.readFile(SESSIONS_FILE, 'utf-8')
    sessionsCache = JSON.parse(raw) as SmaSession[]
    return [...sessionsCache]
  }
  catch {
    sessionsCache = []
    return []
  }
}

export async function getQuestions(sessionId?: string): Promise<SmaQuestion[]> {
  if (!questionsCache) {
    await ensureDataFiles()
    try {
      const raw = await fs.readFile(QUESTIONS_FILE, 'utf-8')
      questionsCache = JSON.parse(raw) as SmaQuestion[]
    }
    catch {
      questionsCache = []
    }
  }

  const list = questionsCache || []
  if (sessionId) {
    return list.filter(q => q.sessionId === sessionId)
  }
  return [...list]
}

export async function getActiveSession(): Promise<SmaSession | null> {
  const sessions = await getSessions()
  // Active or Wrap Up
  const active = sessions.find(s => s.status === 'active' || s.status === 'wrap_up')
  if (active) {
    // Check if wrap_up expired
    if (active.status === 'wrap_up' && active.wrapUpEndsAt) {
      const now = new Date().getTime()
      const endsAt = new Date(active.wrapUpEndsAt).getTime()
      if (now > endsAt) {
        // Auto-end session
        active.status = 'ended'
        active.endedAt = new Date().toISOString()
        await saveSession(active)
      }
    }
    return active
  }
  return null
}

export async function getSession(id: string): Promise<SmaSession | null> {
  const sessions = await getSessions()
  return sessions.find(s => s.id === id) || null
}

export async function saveSession(session: SmaSession): Promise<void> {
  await ensureDataFiles()
  const sessions = await getSessions()
  const index = sessions.findIndex(s => s.id === session.id)

  session.updatedAt = new Date().toISOString()

  if (index >= 0) {
    sessions[index] = session
  }
  else {
    sessions.unshift(session)
  }

  sessionsCache = sessions
  try {
    await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8')
  }
  catch (err) {
    console.error('[sma] Failed to write sessions file:', err)
  }

  // Backup to primary cloud storage if available
  try {
    const adapter = getStorageAdapter()
    if (adapter.isConfigured() && adapter.name !== 'local') {
      const buf = Buffer.from(JSON.stringify(sessions, null, 2), 'utf-8')
      await adapter.uploadMedia(buf, 'sessions.json', 'application/json')
    }
  }
  catch {
    // Non-fatal
  }

  broadcastSmaEvent({
    type: 'session_updated',
    sessionId: session.id,
    session,
    timestamp: new Date().toISOString(),
  })
}

export async function saveQuestion(question: SmaQuestion): Promise<void> {
  await ensureDataFiles()
  const questions = await getQuestions()
  const index = questions.findIndex(q => q.id === question.id)

  if (index >= 0) {
    questions[index] = question
  }
  else {
    questions.push(question)
  }

  questionsCache = questions
  try {
    await fs.writeFile(QUESTIONS_FILE, JSON.stringify(questions, null, 2), 'utf-8')
  }
  catch (err) {
    console.error('[sma] Failed to write questions file:', err)
  }

  // Backup to cloud storage if configured
  try {
    const adapter = getStorageAdapter()
    if (adapter.isConfigured() && adapter.name !== 'local') {
      const buf = Buffer.from(JSON.stringify(questions, null, 2), 'utf-8')
      await adapter.uploadMedia(buf, 'questions.json', 'application/json')
    }
  }
  catch {
    // Non-fatal
  }

  broadcastSmaEvent({
    type: index >= 0 ? 'question_updated' : 'question_created',
    sessionId: question.sessionId,
    question,
    timestamp: new Date().toISOString(),
  })
}

export async function getQuestion(id: string): Promise<SmaQuestion | null> {
  const questions = await getQuestions()
  return questions.find(q => q.id === id) || null
}

export async function addReaction(questionId: string, emoji: string): Promise<SmaQuestion | null> {
  const question = await getQuestion(questionId)
  if (!question) {
    return null
  }

  if (!question.reactions) {
    question.reactions = { '👍': 0, '👎': 0, '❤️': 0, '🔥': 0, '💡': 0 }
  }

  question.reactions[emoji] = (question.reactions[emoji] || 0) + 1

  // Compute Net Sentiment: (positive) - (negative)
  const pos = (question.reactions['👍'] || 0)
    + (question.reactions['❤️'] || 0)
    + (question.reactions['🔥'] || 0)
    + (question.reactions['💡'] || 0)
  const neg = (question.reactions['👎'] || 0)

  question.netSentiment = pos - neg

  await saveQuestion(question)

  broadcastSmaEvent({
    type: 'reaction_updated',
    sessionId: question.sessionId,
    question,
    timestamp: new Date().toISOString(),
  })

  return question
}
