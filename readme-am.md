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

## 7: ፈቃድ (License)

ይህ ፕሮጀክት በ [AGPL-3.0](./LICENSE) ፈቃድ የተጠበቀ ነው።

## 8: የገጽ ፍጥነት (Page Speed Insights)

![Page Speed Metrics](https://cdn.jsdelivr.net/gh/andatoshiki/teleboros@master/.github/assets/pagespeed-metrics.svg)
