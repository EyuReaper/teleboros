# Agents

This document describes the agents used in this project.

## Tasks

- [x] Implement 2-way mirror (Website to Telegram)
  - [x] Add `/compose` UI page with form and image upload
  - [x] Create `/api/compose` API route
    - [x] Add Admin Token authentication
    - [x] Integrate Gemini AI to condense text
    - [x] Send text/image to Telegram via Bot API
    - [x] Trigger Vercel Deploy Hook to rebuild site
  - [x] Update Navigation in `page-frame.tsx` to link to `/compose`
- [x] Enable Markdown formatting for Telegram posts

## Upcoming Features

- [x] Automated Syncing via Telegram Webhooks
  - [x] Create `/api/webhook` route in Next.js
  - [x] Authenticate incoming Telegram Bot webhook requests
  - [x] Trigger Vercel Deploy Hook when new message is detected
  - [x] Document how to set the Telegram webhook URL

- [x] Next.js Image Optimization
  - [x] Find where mirrored images are rendered in React components
  - [x] Replace standard `<img>` tags with `next/image`
  - [x] Ensure correct `width` and `height` properties or fill attributes are set

- [x] Comments Integration
  - [x] Choose comment provider (Telegram Native Comments or Giscus)
  - [x] Add comment widget component to individual post page
  - [x] Add configuration variables in `src/lib/constant.ts` to enable/disable

- [x] Infinite Scroll
  - [x] Implement IntersectionObserver or use a library for the timeline
  - [x] Paginate static data loading gracefully in the feed
  - [x] Update timeline components to append posts instead of replacing

- [x] AI Semantic Search
  - [x] Integrate Gemini embeddings for posts
  - [x] Create an API route to handle search queries
  - [x] Build a frontend search UI for asking natural language questions
  - [x] Update `sync-static-content.ts` to generate and save embeddings during build

- [x] Video Thumbnail Support
  - [x] Update `getVideo()` in `src/lib/telegram/index.ts` to extract `.tgme_widget_message_video_thumb` background image
  - [x] Apply the extracted image URL to the `<video>` tag as the `poster` attribute
  - [x] Ensure `sync-static-content.ts` properly downloads and rewrites the `poster` URL

- [x] Long-Form Publishing & Telegram Teaser Backlinking
  - [x] Store full-length long-form post content on Teleboros (local markdown/JSON repository)
  - [x] Update `/api/compose` to append a backlink to the AI-condensed Telegram post (e.g., `📖 Read full article: <siteUrl>/posts/<id>`)
  - [x] Correlate the resulting Telegram message ID with the stored long-form content
  - [x] Render the complete long-form version on the Teleboros website while Telegram displays the condensed teaser

- [x] Video/Clip Upload Support in Compose
  - [x] Allow image or video/clip file selection in `/compose`
  - [x] Implement `sendVideo` via Telegram Bot API with streaming support
  - [x] Ensure caption backlinking via `editMessageCaption` for video posts

- [x] Pinned Posts & Adaptive Image-Themed Cards
  - [x] Auto-collapsible channel description with toggle on main feed
  - [x] Hybrid pinned post resolution (`pinnedPostIds` in `constant.ts`, `#pinned` tag, and Telegram `getChat.pinned_message`)
  - [x] Dominant color extraction via Sharp for adaptive pinned card glow & borders (with default fallback)
  - [x] Adaptive presentation UI: Style 1 (Timeline Anchor) for single pin, Style 3 (Carousel / Dot Slider) for multi-pins
  - [x] Page 1 placement below description and feed deduplication

- [x] Compose Studio: Dual Preview & Decoupled AI Condensation
  - [x] Split `/api/compose` into AI condensation endpoint and final publish action
  - [x] Add dual preview panel to `/compose` (Telegram Message bubble & Teleboros Website post)
  - [x] Implement editable teaser field with live character counter
  - [x] Support local media instant preview (image/video URL preview)
  - [x] Add responsive mobile toggle (Edit / Preview)

- [x] Dedicated Long-Form Architecture & Telegram Inline Button Publishing
  - [x] Canonical Upfront ID Generation (slug/unique ID) before Telegram broadcast
  - [x] Pre-save full long-form article to Teleboros (Vercel Blob) with zero teaser duplication
  - [x] Telegram Inline Keyboard Button: "Read the full article on Teleboros" attached to short-form broadcast
  - [x] Equal-length / short post detection: publish uniformly without redundant teaser or button when lengths match
  - [x] Real-time publishing telemetry: detailed step-by-step progress, success confirmations, and isolated error reporting in Compose UI
  - [x] Dynamic on-demand page resolution: configure `dynamicParams = true` and synthetic post resolution in `renderPostPage` for zero-delay article availability

## Turnkey Public Release Features (Open Source Readiness)

- [x] Native Telegram Media Groups (Photo/Video Albums)
  - [x] Extract media group IDs and cluster grouped Telegram photos/videos
  - [x] Responsive Masonry / Telegram-style 2x2 and 3x3 collage grid component
  - [x] Interactive full-screen image lightbox & zoom modal for albums
  - [x] Seamless mobile carousel slider fallback

- [x] Telegram Audio & Voice Message Player
  - [x] Support Telegram `.mp3` audio files and `.ogg` voice notes in parser
  - [x] Custom embedded audio player widget with progress scrub bar
  - [x] Waveform visualizer simulation and playback speed control (1x, 1.5x, 2x)
  - [x] Download and metadata display (track title, artist, duration)

- [x] Dynamic Social Sharing Cards (Edge OpenGraph with Satori / @vercel/og)
  - [x] Create `/api/og` dynamic image generation route
  - [x] Render custom branded OG card with post title, date, reading time, and channel avatar
  - [x] Configure automatic `<meta property="og:image">` resolution in `post-page.tsx`
  - [x] Validate Discord, Twitter/X, and Telegram link preview card generation

- [x] Cloudflare R2 Storage Integration (Zero Egress, 10GB Free Tier)
  - [x] Install `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` for S3-compatible R2 client
  - [x] Configure environment variables: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_DOMAIN`
  - [x] Create `/api/upload/r2` presigned URL endpoint for direct client-side large video streaming (bypassing Vercel's 4.5MB serverless limit)
  - [x] Implement `putR2Media` and `saveR2Article` storage helpers to store videos, images, and long-form JSON in Cloudflare R2
  - [x] Update `ComposeForm.tsx` to stream large media directly to Cloudflare R2 with live progress bar
  - [x] Maintain Vercel Blob and local filesystem as automatic fallback adapters if R2 credentials are not set

- [x] Universal Storage Adapter Architecture
  - [x] Abstract storage operations into a unified `StorageAdapter` interface (`uploadMedia`, `savePost`, `loadPost`)
  - [x] `CloudflareR2Adapter` as the recommended primary production adapter
  - [x] `VercelBlobStorageAdapter` for turnkey 1-click Vercel deployments
  - [x] `LocalStorageAdapter` for self-hosted Docker and VPS deployments
  - [x] Graceful degradation: local filesystem writes when cloud tokens are omitted

- [x] Reader Retention & Subscription Engine
  - [x] "Subscribe to Updates" newsletter capture widget on home & post pages
  - [x] Webhook integration for email providers (Resend, Buttondown, Mailchimp)
  - [x] One-click RSS & JSON feed discovery modal
  - [x] Optional Web Push notification framework for new post broadcasts

- [x] Turnkey 1-Click Deploy & Setup Experience
  - [x] "Deploy with Vercel" button in `README.md` with pre-filled environment variables
  - [x] Graceful degradation: operate cleanly if Gemini AI key or Blob token is omitted
  - [x] Complete `.env.example` with step-by-step bot creation walkthrough
  - [x] Dockerfile and `docker-compose.yml` for self-hosters

