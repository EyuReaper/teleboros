import type { Metadata } from 'next'
import { SmaPortal } from '@/components/sma/sma-portal'
import { getAppConfig } from '@/lib/config'
import { getSession } from '@/lib/sma/store'

export const dynamic = 'force-dynamic'

interface SmaSessionPageProps {
  params: Promise<{
    sessionId: string
  }>
}

export async function generateMetadata({ params }: SmaSessionPageProps): Promise<Metadata> {
  const { sessionId } = (await params) ?? {}
  const session = await getSession(sessionId)
  const config = getAppConfig()

  return {
    title: session ? `${session.title} | S.M.A` : `Ask Me Anything | ${config.channel}`,
    description: session?.promptMessage || 'Submit anonymous inquiries and receive cryptographic tokens.',
  }
}

export default async function SmaSessionPage({ params }: SmaSessionPageProps) {
  const { sessionId } = (await params) ?? {}
  const config = getAppConfig()
  const session = await getSession(sessionId)

  return (
    <SmaPortal
      initialSession={session}
      sessionId={sessionId}
      siteTitle={config.channel}
    />
  )
}
