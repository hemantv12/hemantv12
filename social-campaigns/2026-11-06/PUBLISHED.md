# 6 November 2026 — Morning publishing record

Exactly three distinct campaigns were published immediately.

## Instagram — @aagrowthstudio
All three returned successful published-carousel responses. Each carousel contains five images in the specified sequence.

| Campaign | Instagram media ID | Result |
|---|---:|---|
| The Content Series Playbook | 17899683861610875 | Published |
| Motion That Feels Like Your Brand | 18078353816461770 | Published |
| The Product Page Confidence Checklist | 18114709037180265 | Published |

## Facebook — AA Growth Studio
All three returned successful published-photo-post responses.

| Campaign | Facebook Page post ID | Photo ID | Result |
|---|---|---:|---|
| The Content Series Playbook | 1454190361104294_122098195305542560 | 122098195269542560 | Published |
| Motion That Feels Like Your Brand | 1454190361104294_122098195407542560 | 122098195371542560 | Published |
| The Product Page Confidence Checklist | 1454190361104294_122098195509542560 | 122098195467542560 | Published |

## Asset validation
- 15 SVG source slides are stored in this dated folder.
- Every source has a 1080×1350 viewBox and embeds the supplied AA mark image unchanged, with the adjacent “AA GROWTH STUDIO” wordmark.
- All 15 public wsrv.nl URLs were opened and verified to render as JPEG images before publishing; the first slide was additionally confirmed at exactly 1080×1350.
- The Instagram carousel action accepted five JPEG URLs per campaign; Facebook received each campaign's own cover image.
- No AI-generated people, fabricated metrics, client logos, testimonials or awards were used.

## Creative angles for later daily slots
Avoid repeating these three themes later on 6 November:
1. A repeatable content-series format instead of filling a calendar.
2. A motion-design system that feels like the brand.
3. Product-page confidence and answering pre-purchase questions.

## Channel navigation

- Instagram profile: https://www.instagram.com/aagrowthstudio/
- Facebook — The Content Series Playbook: https://www.facebook.com/122097750909542560/posts/122098195305542560
- Facebook — Motion That Feels Like Your Brand: https://www.facebook.com/122097750909542560/posts/122098195407542560
- Facebook — The Product Page Confidence Checklist: https://www.facebook.com/122097750909542560/posts/122098195509542560

Instagram post permalinks were not returned by the publishing action; the three published media IDs above are recorded, and the connected reporting feed had not indexed the new media at verification time.


# 6 November 2026 — Evening publishing record

Exactly three additional distinct campaigns were published immediately.

## Instagram — @aagrowthstudio

All three returned successful published-carousel responses; each carousel contains five separate JPEG slides.

| Campaign | Instagram media ID | Live permalink | Result |
|---|---:|---|---|
| Positioning Before Promotion | 18089614277303239 | https://www.instagram.com/p/DfZgubhDhmo/ | Published |
| The Shoot Brief That Works | 17948530677358518 | https://www.instagram.com/p/DfZgyh5DMJP/ | Published |
| The Homepage Clarity Test | 18207089368375292 | https://www.instagram.com/p/DfZg4FzjOqL/ | Published |

## Facebook — AA Growth Studio

All three returned successful published-photo-post responses and were confirmed with is_published=True.

| Campaign | Facebook Page post ID | Live permalink | Result |
|---|---|---|---|
| Positioning Before Promotion | 1454190361104294_122098513875542560 | https://www.facebook.com/122097750909542560/posts/122098513875542560 | Published |
| The Shoot Brief That Works | 1454190361104294_122098514079542560 | https://www.facebook.com/122097750909542560/posts/122098514079542560 | Published |
| The Homepage Clarity Test | 1454190361104294_122098514397542560 | https://www.facebook.com/122097750909542560/posts/122098514397542560 | Published |

## Asset and brand checks

- 15 individual SVG source slides are stored in this dated folder; each has a 1080×1350 viewBox.
- Every slide embeds the exact supplied AA mark image data unchanged from the morning dated SVG source, alongside the AA GROWTH STUDIO wordmark.
- Each Instagram carousel used five separately rendered JPEG URLs from wsrv.nl at 1080×1350; each matching Facebook post used its own first-slide cover.
- A public wsrv.nl JPEG endpoint was opened successfully in a live browser before publishing; Instagram accepted and published all three five-image carousels.
- No people photography, fabricated statistics, client logos, testimonials, awards or performance claims were used.

## Creative angles to avoid in the remaining 6 November slot

1. Brand positioning before promotion; audience, problem and differentiation.
2. Pre-production briefing and shot-list planning for a campaign shoot.
3. Homepage clarity: who the site serves, the outcome, and the next step.

These are distinct from the morning campaigns and must not be repeated in the night slot.


# 6 November 2026 — Night publishing record (in progress)

Three separate campaigns were created as five-slide carousels, with individual Facebook cover posts. All 15 SVG source slides are stored in `night/` and each was verified through wsrv.nl as a rendered JPEG at 1080×1350 before publishing.

## Instagram — @aagrowthstudio

| Campaign | Instagram media ID | Result |
|---|---:|---|
| Clicks Aren’t the Conversion | 17990588718067367 | Published — 5-image carousel |
| Consistency Isn’t Sameness | 18099727106392196 | Published — 5-image carousel |
| Feedback That Moves Creative | — | Failed on first attempt: application request limit reached; retry pending |

## Facebook — AA Growth Studio

| Campaign | Facebook Page post ID | Result |
|---|---|---|
| Clicks Aren’t the Conversion | 1454190361104294_122098611825542560 | Published |
| Consistency Isn’t Sameness | 1454190361104294_122098612065542560 | Published |
| Feedback That Moves Creative | 1454190361104294_122098612335542560 | Published |

All three Facebook posts returned successful published responses. The third Instagram carousel has not been counted as published because the platform returned an application request-limit error.


## Night slot — final status update

The third Instagram carousel was retried twice after the initial failure; both retries returned the same application request-limit error. It remains unpublished on Instagram and is not counted as live. The other two Instagram five-image carousels were accepted as published. All three matching Facebook photo posts were accepted as published and their public links were verified. Full details, post IDs and links are in [night/PUBLISHED.md](night/PUBLISHED.md).


## Night slot — public-profile reconciliation

The Instagram write endpoint returned “Application request limit reached” on three attempts for the Feedback That Moves Creative carousel. However, a fresh public-profile fetch showed that all three attempts created live Instagram carousels with the same caption and creative. Two are duplicate publications. They were not deleted because the connected Instagram write actions do not expose post deletion, and no separate deletion instruction was given. The two other night campaigns each appear once on Instagram; all three campaigns appear once on Facebook. See [night/PUBLISHED.md](night/PUBLISHED.md) for all five Instagram links, three Facebook links, and the incident details.
