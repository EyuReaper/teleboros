import { Buffer } from 'node:buffer'

/**
 * Shared helpers for AI semantic search.
 *
 * Used by two Node runtimes:
 * - `scripts/sync-static-content.ts` embeds every post at build time and writes
 *   the vectors to `public/search/embeddings.json`.
 * - `/api/semantic-search` embeds the incoming query at runtime and computes
 *   cosine similarity against the saved vectors.
 *
 * This module must never be imported from client components.
 */

export const SEMANTIC_EMBEDDINGS_FILE = 'public/search/embeddings.json'
export const SEMANTIC_EMBEDDINGS_PUBLIC_PATH = '/search/embeddings.json'

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_EMBED_BATCH_SIZE = 100

export const GEMINI_EMBED_TASK_DOCUMENT = 'RETRIEVAL_DOCUMENT' as const
export const GEMINI_EMBED_TASK_QUERY = 'RETRIEVAL_QUERY' as const

export interface EmbedConfig {
  apiKey: string
  model: string
  outputDimensionality: number
}

export interface SemanticEmbeddingDocument {
  id: string
  title: string
  text: string
  datetime: string
  encoding: string
}

export interface SemanticEmbeddingsPayload {
  generatedAt: string
  model: string
  dimension: number
  documents: SemanticEmbeddingDocument[]
}

export function l2Normalize(values: number[]) {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0))
  if (values.length === 0 || magnitude === 0) {
    return values
  }
  return values.map(value => value / magnitude)
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])
const MAX_RETRY_ATTEMPTS = 4

async function fetchWithRetry(url: string, init: RequestInit) {
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, init)

    if (response.ok || !RETRYABLE_STATUS_CODES.has(response.status)) {
      return response
    }

    if (attempt === MAX_RETRY_ATTEMPTS) {
      return response
    }

    await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt))
  }

  throw new Error(`Gemini fetch failed for ${url}`)
}

/**
 * Embed a batch of texts with the configured Gemini model.
 * Splits large corpora into chunks of `GEMINI_EMBED_BATCH_SIZE`.
 */
export async function embedDocuments(texts: string[], config: EmbedConfig): Promise<number[][]> {
  const embeddings: number[][] = []

  for (let offset = 0; offset < texts.length; offset += GEMINI_EMBED_BATCH_SIZE) {
    const chunk = texts.slice(offset, offset + GEMINI_EMBED_BATCH_SIZE)
    const response = await fetchWithRetry(
      `${GEMINI_API_BASE_URL}/models/${config.model}:batchEmbedContents`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.apiKey,
        },
        body: JSON.stringify({
          requests: chunk.map(text => ({
            model: `models/${config.model}`,
            content: { parts: [{ text }] },
            taskType: GEMINI_EMBED_TASK_DOCUMENT,
            outputDimensionality: config.outputDimensionality,
          })),
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Gemini batchEmbedContents failed: ${response.status} ${await response.text()}`)
    }

    const payload = await response.json() as { embeddings?: Array<{ values?: number[] }> }
    for (const embedding of payload.embeddings ?? []) {
      embeddings.push(l2Normalize(embedding.values ?? []))
    }
  }

  return embeddings
}

/** Embed a single search query with the configured Gemini model. */
export async function embedQuery(text: string, config: EmbedConfig): Promise<number[]> {
  const response = await fetchWithRetry(
    `${GEMINI_API_BASE_URL}/models/${config.model}:embedContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        taskType: GEMINI_EMBED_TASK_QUERY,
        outputDimensionality: config.outputDimensionality,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`Gemini embedContent failed: ${response.status} ${await response.text()}`)
  }

  const payload = await response.json() as { embedding?: { values?: number[] } }
  return l2Normalize(payload.embedding?.values ?? [])
}

/** Encode a normalized float vector as compact base64 (Float32LE). */
export function encodeEmbedding(values: number[]) {
  const payload = new Float32Array(values)
  return Buffer.from(payload.buffer).toString('base64')
}

/** Decode a base64 (Float32LE) string back into a typed vector. */
export function decodeEmbedding(encoded: string): Float32Array {
  const buffer = Buffer.from(encoded, 'base64')
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Float32Array.BYTES_PER_ELEMENT)
}

/**
 * Cosine similarity between two vectors. Both are L2-normalized by the
 * embedding layer, so this reduces to a dot product.
 */
export function cosineSimilarity(left: Float32Array | number[], right: Float32Array | number[]) {
  const length = Math.min(left.length, right.length)
  let dot = 0
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index]
  }
  return dot
}

/** Combine title, tags, and body into a single truncated embedding input. */
export function buildSemanticInputText(doc: { title: string, text: string, tags: string }, inputTokenLimit: number) {
  const raw = [doc.title, doc.tags, doc.text].map(part => part.trim()).filter(Boolean).join('\n')
  return raw.slice(0, inputTokenLimit)
}

/** Normalize a natural-language query into ranked search terms for snippet windows. */
export function normalizeSearchTerms(value: string) {
  return [...new Set(
    value
      .trim()
      .split(/\s+/)
      .map(term => term.trim().replace(/^#+/, '').toLowerCase())
      .filter(Boolean),
  )]
}

/** Build a snippet window around the first query-term match inside post text. */
export function buildSnippetWindow(text: string, terms: string[]) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return ''
  }

  if (terms.length === 0) {
    return normalized.length > 200
      ? `${normalized.slice(0, 200).trimEnd()}...`
      : normalized
  }

  const lowered = normalized.toLowerCase()
  let firstMatchIndex = -1
  for (const term of terms) {
    const candidate = lowered.indexOf(term)
    if (candidate !== -1 && (firstMatchIndex === -1 || candidate < firstMatchIndex)) {
      firstMatchIndex = candidate
    }
  }

  if (firstMatchIndex === -1) {
    return normalized.length > 200
      ? `${normalized.slice(0, 200).trimEnd()}...`
      : normalized
  }

  const start = Math.max(0, firstMatchIndex - 80)
  const end = Math.min(normalized.length, firstMatchIndex + 160)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < normalized.length ? '...' : ''
  return `${prefix}${normalized.slice(start, end).trim()}${suffix}`
}
