import type { SemanticEmbeddingDocument, SemanticEmbeddingsPayload } from '@/lib/search/semantic'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { NextResponse } from 'next/server'
import { getAppConfig } from '@/lib/config'
import {
  buildSnippetWindow,
  cosineSimilarity,
  decodeEmbedding,
  embedQuery,
  normalizeSearchTerms,
  SEMANTIC_EMBEDDINGS_FILE,
} from '@/lib/search/semantic'

const MAX_QUERY_LENGTH = 500

interface SemanticSearchResult {
  id: string
  title: string
  datetime: string
  snippet: string
  similarity: number
}

let embeddingsCache: { mtimeMs: number, payload: SemanticEmbeddingsPayload | null } | null = null

async function loadEmbeddings(): Promise<SemanticEmbeddingsPayload | null> {
  const absolutePath = path.resolve(process.cwd(), SEMANTIC_EMBEDDINGS_FILE)

  try {
    const fileStat = await stat(absolutePath)
    if (embeddingsCache?.mtimeMs === fileStat.mtimeMs) {
      return embeddingsCache.payload
    }

    const payload = await readFile(absolutePath, 'utf8')
      .then(raw => JSON.parse(raw) as SemanticEmbeddingsPayload)
      .catch(() => null)

    embeddingsCache = { mtimeMs: fileStat.mtimeMs, payload }
    return payload
  }
  catch {
    return null
  }
}

export async function POST(req: Request) {
  const config = getAppConfig()
  const semanticSearch = config.semanticSearch

  if (!semanticSearch.enabled) {
    return NextResponse.json({ error: 'Semantic search is not enabled' }, { status: 503 })
  }

  const geminiApiKey = process.env.GEMINI_API_KEY?.trim()
  if (!geminiApiKey) {
    return NextResponse.json({ error: 'Semantic search is not configured (GEMINI_API_KEY missing)' }, { status: 503 })
  }

  let body: { q?: unknown, limit?: unknown }
  try {
    body = await req.json()
  }
  catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const query = typeof body.q === 'string' ? body.q.trim() : ''
  if (!query) {
    return NextResponse.json({ error: 'Query (q) is required' }, { status: 400 })
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: `Query must be ${MAX_QUERY_LENGTH} characters or fewer` }, { status: 400 })
  }

  const requestedLimit = Number(body.limit)
  const limit = Number.isFinite(requestedLimit) && requestedLimit >= 1
    ? Math.min(Math.floor(requestedLimit), semanticSearch.maxResults)
    : semanticSearch.maxResults

  const payload = await loadEmbeddings()
  if (!payload?.documents?.length) {
    return NextResponse.json({ error: 'Semantic embeddings are not built yet. Rebuild the site.' }, { status: 503 })
  }

  const embedConfig = {
    apiKey: geminiApiKey,
    model: payload.model || semanticSearch.model,
    outputDimensionality: payload.dimension || semanticSearch.outputDimensionality,
  }

  const queryVector = await embedQuery(query, embedConfig)

  const results: SemanticSearchResult[] = payload.documents
    .map((doc: SemanticEmbeddingDocument) => ({
      id: doc.id,
      title: doc.title,
      datetime: doc.datetime,
      snippet: doc.text,
      encoding: doc.encoding,
    }))
    .map(doc => ({
      id: doc.id,
      title: doc.title,
      datetime: doc.datetime,
      snippet: buildSnippetWindow(doc.snippet ?? '', normalizeSearchTerms(query)),
      similarity: cosineSimilarity(queryVector, decodeEmbedding(doc.encoding)),
    }))
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, limit)

  return NextResponse.json({
    query,
    model: payload.model,
    dimension: payload.dimension,
    results,
  })
}
