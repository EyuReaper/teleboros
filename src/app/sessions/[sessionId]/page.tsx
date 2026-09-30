import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ThreadView } from '@/components/sma/thread-view'
import { getAppConfig } from '@/lib/config'
import { getQuestions, getSession } from '@/lib/sma/store'

export const dynamic = 'force-dynamic'

interface SessionTranscriptPageProps {
  params: Promise<{
    sessionId: string
  }>
}

export async function generateMetadata({ params }: SessionTranscriptPageProps): Promise<Metadata> {
  const { sessionId } = (await params) ?? {}
  const session = await getSession(sessionId)
  const config = getAppConfig()

  return {
    title: session ? `Transcript: ${session.title} | ${config.channel}` : `S.M.A Transcript | ${config.channel}`,
    description: session?.promptMessage || 'Permanent archive and transcript of community AMA inquiries and creator answers.',
  }
}

export default async function SessionTranscriptPage({ params }: SessionTranscriptPageProps) {
  const { sessionId } = (await params) ?? {}
  const session = await getSession(sessionId)
  const config = getAppConfig()

  if (!session) {
    notFound()
  }

  const questions = await getQuestions(session.id)

  return (
    <ThreadView
      session={session}
      initialQuestions={questions}
      channelTitle={config.channel}
      channelAvatar="/logo.png"
    />
  )
}
