<p align="center">
  <img src="./public/logo.png" alt="Teleboros Logo" width="150" />
</p>

# ቴሌቦሮስ (Teleboros)

> [!WARNING]
> ይህ ሰነድ በዝግጅት ላይ ነው። አንዳንድ ክፍሎች ያልተሟሉ ሊሆኑ ይችላሉ።

> የቴሌግራም ቻናልዎን ፈጣን፣ ሊፈለግ የሚችል እና በውብ ዲዛይን የተገነባ ድር ጣቢያ የሚያደርግ፣ በ Next.js፣ React፣ shadcn/ui እና Tailwind CSS የተገነባ የማይክሮብሎግ ሥርዓት።

[English](./readme.md)

## 1: ይህ ፕሮጀክት ለምን ተሰራ

ይህ ፕሮጀክት በ [@miantiao-me](https://github.com/miantiao-me) የተሰራውን [BroadcastChannel](https://github.com/miantiao-me/BroadcastChannel) ሙሉ በሙሉ እንደገና የተገነባ ነው። በ Next.js፣ በ DPlayer ቪዲዮ ማጫወቻ፣ በቴሌግራም መሰል የምስል አቀማመጥ፣ በ Lunr.js ሙሉ የጽሁፍ ፍለጋ እና በ Gemini የተጎላበተ **AI ትርጉም ፍለጋ (semantic search)** ተዘጋጅቷል።

## 2: ፈጣን ጅምር

### 2.1: የሚያስፈልጉ ነገሮች

1. Node.js `>=22`
2. pnpm `>=10`

### 2.2: መጫን እና ማስኬድ

```bash
pnpm install
pnpm dev
```

የልማት ሰርቨሩ በፖርት `4321` ይጀምራል።

### 2.3: ለምርት ማዘጋጀት (Build)

```bash
pnpm build
pnpm start
```

## 3: ውቅር (Configuration)

ሁሉም ውቅሮች በአንድ ፋይል ውስጥ ይገኛሉ: `src/lib/constant.ts`።

### 3.1: የቻናል እና የጣቢያ መረጃ

| ቁልፍ | ዓይነት | መግለጫ |
| --- | --- | --- |
| `channel` | `string` | የቴሌግራም ቻናል የተጠቃሚ ስም (ያለ @) |
| `siteUrl` | `string` | የጣቢያው ዋና አድራሻ (ምሳሌ: `https://tg.example.com`) |
| `telegramHost` | `string` | የቴሌግራም ዌብ ሆስት (ነባሪው `t.me`) |
| `locale` | `string` | ነባሪ ቋንቋ። የሚደገፉት: `en`, `ja`, `am` |
| `timezone` | `string` | የቀን እና ሰዓት ዞን (ምሳሌ: `UTC`, `Africa/Addis_Ababa`) |
| `pinnedPostIds` | `string[]` | በገጹ አናት ላይ የሚሰኩ የቴሌግራም መልዕክት መለያዎች (ምሳሌ: `['120']`) |

### 3.2: AI ትርጉም ፍለጋ (AI Semantic Search)

AI ትርጉም ፍለጋ በ `/search` ገጽ ላይ ተጠቃሚዎች ጥያቄዎችን በተፈጥሮ ቋንቋ እንዲጠይቁ ያስችላል (ለምሳሌ: "ስለ Go ማሰማራት ምን ጽፌ ነበር?")። ጽሁፎቹ በ `pnpm sync` ጊዜ አንዴ ብቻ በ Gemini ይቀመራሉ፣ እና እያንዳንዱ ጥያቄ በ `/api/semantic-search` በኩል አንድ ጥያቄን ብቻ ያቀምራል። ይህን ለማንቃት `GEMINI_API_KEY` በተገነባ (build) እና በሂደት (runtime) በሁለቱም ጊዜ መገኘት አለበት። `semanticSearch.enabled` በ `false` በማድረግ ማጥፋት ይቻላል።

## 4: የማመሳሰል ትእዛዝ (Sync Command)

```bash
pnpm sync [flags]
```

## 5: ማሰማራት (Deployment)

> [!WARNING]
> ይህ ክፍል በዝግጅት ላይ ነው።

## 6: በዌብሁክ በኩል አውቶማቲክ ማመሳሰል (Automated Syncing via Webhooks)

በቻናልዎ ውስጥ አዲስ መልዕክት ሲለጠፍ በራስ-ሰር የ Vercel ድጋሚ ግንባታን ለመቀስቀስ የቴሌግራም ቦት ዌብሁክን ማዘጋጀት ይችላሉ።

### 6.1: የአካባቢ ተለዋዋጮች (Environment Variables)

በ Vercel ማሰማሪያዎ ውስጥ የሚከተሉትን የአካባቢ ተለዋዋጮች ያዋቅሩ:

- `TELEGRAM_WEBHOOK_SECRET`: ያመነጩት ደህንነቱ የተጠበቀ ሚስጥራዊ ቁልፍ።
- `DEPLOY_HOOK_URL`: የእርስዎ የ Vercel Deploy Hook አድራሻ።

### 6.2: ዌብሁክን ያዘጋጁ

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<YOUR_SITE_URL>/api/webhook",
    "secret_token": "<YOUR_TELEGRAM_WEBHOOK_SECRET>"
  }'
```

## 7: ረጅም ጽሁፍ ማተም እና የቴሌግራም አጭር መልዕክት ማገናኛ (Long-Form Publishing & Teaser Backlinking)

ቴሌቦሮስ በ `/compose` ገጽ በኩል ሙሉና ረጅም የማርክዳውን (Markdown) ጽሁፎችን በቀጥታ ከድረ-ገጽዎ ሆነው እንዲጽፉ እና የቴሌግራምን የጽሁፍ ገደብ ሳያልፉ ወደ ቴሌግራም እንዲያጋሩ ያስችላል።

### 7.1: እንዴት እንደሚሰራ

1. **መጻፍ (Compose)**: ሙሉ ጽሁፍዎን በማርክዳውን በ `/compose` ገጽ ላይ ይጻፉ (በ `ADMIN_TOKEN` የተጠበቀ ነው)፤ አማራጭ ርዕስ እና ሚዲያ (ምስል ወይም አጭር ቪዲዮ/ክሊፕ) ማያያዝ ይችላሉ።
2. **በ AI ማጠቃለል**: የጉግል ጀሚናይ (Gemini) AI ጽሁፍዎን በራስ-ሰር በማጠቃለል ለቴሌግራም ማራኪ የሆነ አጭር ማጠቃለያ ያዘጋጃል፤ እንዲሁም የቴሌግራምን የጽሁፍ ገደብ ያከብራል።
3. **ወደ ቴሌግራም መላክ**: ቴሌቦሮስ አጭር ማጠቃለያውን እና የተያያዘውን ሚዲያ (ለምስል በ `sendPhoto` ወይም ለቪዲዮ ክሊፕ በ `sendVideo`) በቴሌግራም ቦት በኩል ወደ ቻናልዎ ያሰራጫል።
4. **የኋላ ማገናኛ (Backlink)**: ቴሌቦሮስ የቴሌግራም መልዕክት መለያውን (message_id) በመቀበል፣ በቴሌግራም ላይ የተለጠፈውን መልዕክት ወዲያውኑ በማስተካከል ሙሉውን ጽሁፍ በቴሌቦሮስ ለማንበብ የሚያስችል ማስፈንጠሪያ ያክላል (`📖 Read full article on Teleboros: https://<siteUrl>/posts/<id>`)፤ እንዲሁም ሙሉውን ጽሁፍ በ `data/posts/<id>.json` ያስቀምጣል።
5. **ሙሉ ጽሁፍ ማቅረብ**: የቴሌግራም ተከታዮች አጭሩን ማጠቃለያ ከማስፈንጠሪያ ጋር ሲያገኙ፣ በቴሌቦሮስ ድረ-ገጽ ላይ የሚገቡ አንባቢዎች ግን ሙሉውንና በውብ ቅርጸት የተዘጋጀውን ጽሁፍ በ `/posts/<id>` ያነባሉ።
6. **ፍለጋ**: በዋናው ገጽ ላይ `Read full article →` የሚል ምልክት ይታያል፤ እንዲሁም ሙሉው ጽሁፍ በ Lunr እና በ Gemini AI የትርጉም ፍለጋ (semantic search) ውስጥ ይካተታል።
7. **ቀጥታ ግንባታ**: `DEPLOY_HOOK_URL` ከተዋቀረ፣ ጽሁፉ ወዲያውኑ እንዲታይ አዲስ የ Vercel ግንባታ ይቀሰቀሳል።

### 7.2: የአካባቢ ተለዋዋጮች (Environment Variables)

ይህን ባህሪ ለማንቃት የሚከተሉትን ተለዋዋጮች ያዋቅሩ:

| ተለዋዋጭ | መግለጫ |
| --- | --- |
| `ADMIN_TOKEN` | በ `/compose` ለመግባት እና ለማተም የሚያስፈልግ ሚስጥራዊ የይለፍ ቃል |
| `GEMINI_API_KEY` | ረጅም ጽሁፉን ወደ አጭር ማጠቃለያ ለመቀየር የሚያገለግል የ Gemini API ቁልፍ |
| `TELEGRAM_BOT_TOKEN` | በቻናልዎ ውስጥ ለመለጠፍ ፈቃድ ያለው የቴሌግራም ቦት ቶከን |
| `TELEGRAM_CHAT_ID` | የቴሌግራም ቻናል የተጠቃሚ ስም (ምሳሌ: `@your_channel`) ወይም መለያ ቁጥር |
| `DEPLOY_HOOK_URL` | *(አማራጭ)* ከተለጠፈ በኋላ ድረ-ገጹን ወዲያውኑ እንደገና ለመገንባት የሚያገለግል የ Vercel Deploy Hook |

## 8: የቴሌግራም ድምፅ እና የድምፅ መልዕክቶች ማጫወቻ (Telegram Audio & Voice Message Player)

ቴሌቦሮስ የቴሌግራም ኦዲዮ ፋይሎችን እና የድምፅ መልዕክቶችን (voice notes) በራሱ አዲስና ዘመናዊ ማጫወቻ ይደግፋል:

- **የቅርጸት ድጋፍ**: የቴሌግራም `.mp3`፣ `.m4a`፣ `.wav` የኦዲዮ ፋይሎችን እና `.ogg`/`.oga` የድምፅ መልዕክቶችን በቀጥታ ይደግፋል።
- **ይዘት ጠቋሚ እና ማስተካከያ (Progress Scrub Bar)**: በጊዜ ሰሌዳው ላይ በመጎተት ወይም በመጫን በቀላሉ ወደሚፈልጉት የድምፅ ክፍል ማሳለፍ የሚያስችል ነው።
- **የድምፅ ሞገድ ምስል (Waveform Visualizer)**: የቴሌግራምን ትክክለኛ የሞገድ ውሂብ በማንበብ ያሳያል፤ ካልተገኘም በራስ-ሰር ተፈጥሯዊ የድምፅ ሞገድ አመንጭቶ ያቀርባል። በሞገዱ ላይ በመጫን በቀጥታ ማጫወት ይቻላል።
- **የማጫወቻ ፍጥነት (Speed Control)**: የማጫወቻ ፍጥነትን በ `1x`፣ `1.5x`፣ እና `2x` መካከል በቀላሉ መቀያየር ይቻላል።
- **የፋይል መረጃ እና ማውረጃ (Download & Metadata)**: የዘፈን ወይም የድምፅ ርዕስ፣ የአርቲስት ስም፣ ርዝመት እና የፋይል መጠን ያሳያል፤ እንዲሁም በቀጥታ ለማውረድ የሚያስችል ቁልፍ አለው።

## 9: ተለዋዋጭ የማህበራዊ ሚዲያ ማጋሪያ ካርዶች (Dynamic Social Sharing Cards - Edge OpenGraph)

እያንዳንዱ ጽሁፍ እና መልዕክት በኤጅ (Edge) ላይ በራስ-ሰር የሚመነጩ ውብ ባለ 1200x630 የማህበራዊ ሚዲያ ቅድመ-ዕይታ ካርዶችን ይጠቀማል:

- **በኤጅ ላይ የተመሰረተ ምስል ማመንጨት**: በ `next/og` እና Satori የተጎላበተ ፈጣን የ PNG ምስል ማመንጨት እና በአለም አቀፍ የይዘት ማሰራጫ (CDN) የሚቀመጥ።
- **የጽሁፉ ዝርዝር መረጃዎች**: የጽሁፉ ሙሉ ርዕስ፣ የታተመበት ቀን፣ የንባብ ርዝመት (ለምሳሌ: `3 min read`)፣ የቻናሉ ስም እና አርማ (avatar) በግልጽ ይታያሉ።
- **ሙሉ የማህበራዊ ሚዲያ ድጋፍ**: ለ Discord፣ Twitter/X፣ Telegram፣ LinkedIn እና Facebook ከፍተኛ ጥራት ያላቸውን ቅድመ-ዕይታ ካርዶች ያቀርባል።

## 10: የቴሌግራም ሚዲያ አልበሞች እና ማሳያ (Native Telegram Media Groups - Photo/Video Albums)

ቴሌቦሮስ የቴሌግራም ፎቶዎችን እና ቪዲዮዎችን በአንድ ላይ የተሰባሰቡ አልበሞችን (Media Groups) በውብ የኮላጅ ቅርጽ እና በዘመናዊ የፎቶ ማሳያ (Lightbox) ያቀርባል:

- **የአልበም መረጃዎችን ማሰባሰብ (Media Group Clustering)**: በቴሌግራም የተለጠፉ ተከታታይ ፎቶዎችን እና ቪዲዮዎችን በመለየት በአንድ አልበም ስር ያደራጃል (`data-album-id`, `data-media-index`, `data-total`)።
- **የቴሌግራም ስታይል ኮላጅ (Telegram-Style Collage Solver)**: ከ2 እስከ 10 የሚደርሱ ፎቶዎችን/ቪዲዮዎችን ትክክለኛ ቅርጻቸውን ጠብቆ በቴሌግራም ዴስክቶፕ እይታ ልክ በረድፍ፣ በአምድ ወይም በ L-ቅርጽ በተመጣጠነ ሬክታንግል ያዘጋጃል።
- **ሙሉ ገጽ የፎቶና ቪዲዮ ማሳያ (Interactive Full-Screen Lightbox & Zoom)**: ማንኛውንም ፎቶ ወይም ቪዲዮ ሲጫኑ ሙሉውን ስክሪን የሚሸፍን ማሳያ ይከፈታል፤ በኪቦርድ ቀስቶች (`ArrowLeft`/`ArrowRight`/`Escape`) መቀያየር፣ በስልክ ላይ በጣት ማሳለፍ (swipe gestures)፣ ማሳደጊያ/ማሳነሻ (`+`/`-`)፣ የፎቶዎች ቁጥር (`3 / 8`) እና ቀጥታ ማውረጃ ያካትታል።
- **ለተንቀሳቃሽ ስልኮች ተስማሚ እይታ (Mobile Carousel Fallback)**: ከ 640px በታች በሆኑ የስልክ ስክሪኖች ላይ፣ አልበሞች በጣት ወደ ግራ እና ቀኝ በቀላሉ ወደሚንሸራሸር (carousel) ይቀየራሉ፤ እንዲሁም የገጽ ጠቋሚ ነጥቦች (dots) አሏቸው።

## 11: ፈቃድ (License)

ይህ ፕሮጀክት በ [AGPL-3.0](./LICENSE) ፈቃድ የተጠበቀ ነው።

## 12: የገጽ ፍጥነት (Page Speed Insights)

![Page Speed Metrics](https://cdn.jsdelivr.net/gh/andatoshiki/teleboros@master/.github/assets/pagespeed-metrics.svg)
