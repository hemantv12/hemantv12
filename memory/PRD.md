# SwapKaro — Product Requirements

## Vision
India's first AI-powered skill barter network. No cash — only skills.
"Main tera logo design karunga, tu mera tax bharda."

## Stack
- **Frontend:** Expo SDK 54 (React Native), expo-router, Moti, react-native-reanimated, Ionicons, expo-blur, expo-haptics, expo-linear-gradient, @gorhom/bottom-sheet, lottie-react-native
- **Backend:** FastAPI + Motor (MongoDB)
- **AI:** Claude Sonnet 4.6 via `emergentintegrations` (Emergent Universal LLM Key)
- **Auth:** Mock phone OTP (always `123456`) + JWT (30-day)
- **Payments:** Mock Razorpay (Pro upgrade + Boost listing)

## Screens Built
1. Splash — animated brand mark, tagline "Hunar Badlo. Paise Nahi."
2. Onboarding — 3 swipeable slides (Apna Hunar Do · AI Dhundega Match · Barter Karo, Badho)
3. Login — phone + 6-box OTP with shake on error, Google CTA (mock)
4. Profile Setup — 3 steps (intro → offered skills with level → needed skills) with AI autocomplete
5. Home / Barter Board — greeting, search, category filter chips, perfect-match banner, staggered feed cards
6. AI Matches — Claude-generated Hinglish "kyun match hua" reasoning, animated scanning ring
7. Swaps — milestone-tracked list of active deals
8. Profile — avatar with orange ring, SwapScore (847 style), score bars, Pro upsell card, skill chips with verified badge
9. Chat — WhatsApp-style bubbles, SwapBot AI toggle, milestone advance, AI agreement opener
10. SwapKaro Pro — gold shimmer, Free vs Pro compare, Monthly/Yearly plans
11. Boost — listing duration packs with mock Razorpay
12. Skill Verification — AI-generated 3-question quiz → gold "Verified" badge
13. Notifications — typed list with relative time
14. User Detail — public profile view with swap CTA

## Monetization (mock for demo)
- **Pro:** ₹99/mo or ₹799/yr — `/api/pro/upgrade` flips `is_pro`
- **Boost:** ₹29/49/149 for 24h/48h/7d — `/api/boost` sets `boost_until`
- **Verification:** ₹299/skill — `/api/skills/verify-submit` flips `verified` on a skill

## AI Endpoints (Claude Sonnet 4.6)
- `GET /api/matches/ai` — top-3 matches with Hinglish reasoning
- `POST /api/swaps` — auto agreement opener
- `POST /api/swaps/:id/bot` — SwapBot Q&A
- `POST /api/skills/verify-quiz` — generates JSON quiz

## Design Tokens
Background `#0A0A0A` · Surface `#1C1C1C` · Brand `#FF6B35` · Teal `#00C896` · Gold `#FFD700`. Premium CRED-style dark UI, generous spacing, micro-animations everywhere.

## v2 Polish (added after MVP)
- **Confetti micro-celebration** — pure-Reanimated 30/40/50-piece confetti on AI matches found, Pro upgrade, and Skill Verification pass
- **Image uploads** (expo-image-picker, base64 storage)
  - Profile avatar (square crop) — tap avatar to replace
  - Chat image attachments — paperclip icon, preview chip, image bubble rendering
- **Permissions wired** — `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription`, Android `READ_MEDIA_IMAGES`, expo-image-picker plugin in `app.json`
- **Web shadow cleanup** — `cardShadow`, `glow`, onboarding `iconWrap`, `perfectGlow` now Platform.select between native `shadow*` and web `boxShadow`; eliminates RN deprecation warnings on the preview build
