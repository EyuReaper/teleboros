export interface SmaColorToken {
  name: string
  hex: string
  bgHex: string
  borderHex: string
  textHex: string
  tokenNumber: number
  badge: string // e.g. "● Cosmic Violet #104"
}

export type SmaSessionStatus = 'active' | 'wrap_up' | 'ended'

export interface SmaSession {
  id: string
  title: string
  headline: string
  promptMessage: string
  status: SmaSessionStatus
  createdAt: string
  updatedAt?: string
  wrapUpDurationMinutes?: number
  wrapUpEndsAt?: string // ISO string
  endedAt?: string
  channelPostId?: string // Announcement post ID on channel
  linkedDiscussionChatId?: string | number // Discussion supergroup ID
  discussionThreadMessageId?: string | number // Thread root message ID in supergroup
  recapPostId?: string // Long-form recap post ID on Teleboros
  recapArticleUrl?: string
  stats?: {
    totalQuestions: number
    answeredQuestions: number
    netSentiment: number
  }
}

export type SmaQuestionStatus = 'pending' | 'queued' | 'answered' | 'dismissed'

export interface SmaReactionCounts {
  '👍': number
  '👎': number
  '❤️': number
  '🔥': number
  '💡': number
  [key: string]: number
}

export interface SmaAnswer {
  text: string
  createdAt: string
  telegramMessageId?: string
  telegramCommentId?: string
  deepLink?: string
  cardImageUrl?: string
}

export interface SmaQuestion {
  id: string
  sessionId: string
  text: string
  colorToken: SmaColorToken
  senderSeedHash: string
  createdAt: string
  status: SmaQuestionStatus
  isStarred?: boolean
  reactions: SmaReactionCounts
  netSentiment: number // (👍 + ❤️ + 🔥 + 💡) - (👎)
  aiDraft?: string
  reply?: SmaAnswer
}

export interface SmaSubmissionReceipt {
  questionId: string
  sessionId: string
  colorToken: SmaColorToken
  submittedAt: string
  message: string
}

export interface SmaEventPayload {
  type: 'question_created' | 'question_updated' | 'session_updated' | 'reaction_updated'
  sessionId: string
  question?: SmaQuestion
  session?: SmaSession
  timestamp: string
}
