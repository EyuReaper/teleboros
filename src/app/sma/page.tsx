import type { Metadata } from 'next'
import { SmaPortal } from '@/components/sma/sma-portal'
import { getAppConfig } from '@/lib/config'
import { getActiveSession } from '@/lib/sma/store'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const config = getAppConfig()
  return {
    title: `Ask Me Anything (S.M.A) | ${config.channel}`,
    description: 'Submit anonymous questions, thoughts, and inquiries directly to the channel creator.',
  }
}

export default async function SmaIndexPage() {
  const config = getAppConfig()
  const activeSession = await getActiveSession()

  return (
    <SmaPortal
      initialSession={activeSession}
      siteTitle={config.channel}
    />
  )
}
