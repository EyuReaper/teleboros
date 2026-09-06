import type { ChannelInfo } from '@/lib/types'
import Image from 'next/image'
import { PageFrame } from '@/components/site/page-frame'
import { DEFAULT_LOCALE, getLocaleMessages } from '@/lib/i18n'
import { getStaticSnapshot } from '@/lib/telegram/static-snapshot'
import { ComposeForm } from './ComposeForm'

export const dynamic = 'force-static'

export default async function ComposePage() {
  const locale = DEFAULT_LOCALE
  const messages = getLocaleMessages(locale)
  const snapshot = await getStaticSnapshot()
  const channel = snapshot.root as ChannelInfo

  return (
    <PageFrame channel={channel} currentPath="/compose" locale={locale} messages={messages} currentLocalePath="/compose" wide>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-2 flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Teleboros"
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-contain"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Compose Studio</h1>
            <p className="text-xs text-muted-foreground">Draft long-form posts, refine AI teasers, and broadcast to Telegram</p>
          </div>
        </div>
        <div className="mt-6">
          <ComposeForm />
        </div>
      </div>
    </PageFrame>
  )
}
