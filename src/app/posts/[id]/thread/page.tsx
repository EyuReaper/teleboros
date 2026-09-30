import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ThreadView } from '@/components/sma/thread-view'
import { getAppConfig } from '@/lib/config'
import { getActiveSession, getQuestions, getSession } from '@/lib/sma/store'

export const dynamic = 'force-dynamic'

interface ThreadPageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: ThreadPageProps): Promise<Metadata> {
  const { id } = (await params) ?? {}
  const session = await getSession(id) || await getActiveSession()
  const config = getAppConfig()

  return {
    title: session ? `Discussion Thread: ${session.title} | ${config.channel}` : `Discussion Thread | ${config.channel}`,
    description: session?.promptMessage || 'Live anonymous Q&A discussion thread with Reddit-style branching answers.',
  }
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { id } = (await params) ?? {}
  const config = getAppConfig()

  let session = await getSession(id)
  if (!session) {
    const active = await getActiveSession()
    if (active && (active.id === id || active.channelPostId === id)) {
      session = active
    }
  }

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
