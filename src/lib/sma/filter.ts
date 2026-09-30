const rateLimitMap = new Map<string, { count: number, resetAt: number }>()

// Basic profanity / toxicity filter list
const BANNED_PATTERNS = [
  /\b(?:nigger|faggot|kike|chink|spic)\b/i,
  /\b(?:kill\s+yourself|die\s+in\s+a\s+fire)\b/i,
]

export interface FilterResult {
  allowed: boolean
  error?: string
}

export function checkHoneypot(honeypotValue?: string | null): boolean {
  if (honeypotValue && honeypotValue.trim().length > 0) {
    return false // Bot filled hidden field
  }
  return true
}

export function checkRateLimit(clientIdentifier: string, maxRequests = 5, windowMs = 60_000): boolean {
  const now = Date.now()
  const current = rateLimitMap.get(clientIdentifier)

  if (!current || now > current.resetAt) {
    rateLimitMap.set(clientIdentifier, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (current.count >= maxRequests) {
    return false
  }

  current.count += 1
  return true
}

export function validateQuestionText(text: string): FilterResult {
  const trimmed = text?.trim() || ''

  if (!trimmed) {
    return { allowed: false, error: 'Question cannot be blank.' }
  }

  if (trimmed.length < 5) {
    return { allowed: false, error: 'Question is too short (minimum 5 characters).' }
  }

  if (trimmed.length > 1000) {
    return { allowed: false, error: 'Question exceeds maximum length of 1,000 characters.' }
  }

  // Check banned patterns
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: false, error: 'Question contains restricted or prohibited language.' }
    }
  }

  // Detect repetitive link spam
  const linkMatches = trimmed.match(/https?:\/\//gi)
  if (linkMatches && linkMatches.length > 2) {
    return { allowed: false, error: 'Excessive links detected. Please remove promotional URLs.' }
  }

  return { allowed: true }
}
