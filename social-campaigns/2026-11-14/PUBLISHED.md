# Publishing record — 14 November 2026 — 8 PM standalone campaign

## Campaign
**A Blank Screen Still Has a Job.**
- Format: exactly one standalone single-image feed campaign (not a carousel).
- Audience: US SaaS founders, product leads and product managers.
- Primary keyword: SaaS empty state UX.
- Instagram hashtags: #SaaSFounders #ProductDesign #UXDesign #SaaS #UserExperience.
- Source SVG: https://github.com/hemantv12/hemantv12/blob/aa-growth-social-assets/social-campaigns/2026-11-14/01_a_blank_screen_still_has_a_job.svg
- Public JPEG: https://wsrv.nl/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fhemantv12%2Fhemantv12%2Faa-growth-social-assets%2Fsocial-campaigns%2F2026-11-14%2F01_a_blank_screen_still_has_a_job.svg&w=1080&h=1350&fit=cover&output=jpg&q=92

## Same-day duplicate preflight
- Instagram media-history read for 14 Nov 2026 before publishing: 0 media rows with media_id not null.
- Facebook Page post read for 14 Nov 2026 before publishing: 0 rows.
- Exactly one campaign and one artwork were created for this slot.

## Instagram — @aagrowthstudio (17841464848354217)
- Initial write action: create_image_post.
- Exact write response: **Error — Application request limit reached**.
- Retry policy: stopped immediately; no further Instagram write attempt was made.
- Read-only reconciliation: a subsequent date-scoped Instagram media-history read returned exactly one matching IMAGE / FEED media object with the exact campaign caption.
- Media ID: 18144563635622081.
- Platform timestamp: 2026-11-14T14:41:56Z.
- Permalink: https://www.instagram.com/p/DfucewjiC7-/
- Public verification: a fresh fetch of the permalink returned the AA Growth Studio account context, exact campaign caption, canonical permalink and the newly published image preview. The page showed 0 likes and 0 comments at the time of verification; this is an early snapshot, not a performance conclusion.
- Final status: **PUBLISHED — confirmed by media-history record and public permalink**, despite the write response returning a rate-limit error. No retry or duplicate was created.

## Facebook — AA Growth Studio Page (1454190361104294)
- Action: create_photo_post.
- Connector write response: **Published photo post to Facebook Page 1454190361104294.**
- Photo ID: 122105705763542560.
- Post ID: 1454190361104294_122105705787542560.
- Canonical public permalink returned by the public page metadata: https://www.facebook.com/61596276803527/posts/your-saas-product-has-more-than-one-kind-of-empty-screen-they-shouldnt-all-say-n/122105705787542560/
- Public verification: a fresh fetch returned the exact Facebook caption, canonical post URL and the published photo preview.
- The connected Facebook organic read-back did not include this new post yet (the latest returned records ended on 13 Nov); the successful write response and public permalink/preview confirm publication.

## Image and creative QA
- Source SVG viewBox: 1080 × 1350 (4:5), one individual artwork.
- wsrv.nl browser verification: HTTP 200; Content-Type image/jpeg; naturalWidth 1080; naturalHeight 1350.
- Browser visual check: no clipped text, malformed SVG or broken logo rendering reported.
- Exact official AA symbol SVG markup was retrieved from https://aagrowthstudio.com/assets/aa-symbol.svg and embedded unchanged. The original 0 0 100 100 viewBox, paths, gradients, filters and fills are preserved.
- No stock or AI photography, fake UI, fake customers, testimonials, fabricated numbers or client outcome claims.
- Exact rendered JPEG byte size was not exposed by browser inspection. The 8 MB ceiling could not be independently byte-measured; both platforms accepted/previewed the image.

## Captions, metadata and limits
- Instagram caption and Facebook-native caption: CAPTIONS.md.
- Primary keyword: SaaS empty state UX.
- Supporting phrases: empty state design; first-use screen UX; no-results state; product UI/UX design; error-state UX.
- Hashtags: #SaaSFounders #ProductDesign #UXDesign #SaaS #UserExperience.
- Public Instagram topic pages for ProductDesign, UXDesign and SaaSFounders were checked for relevance. #SaaSUX and #EmptyStateUX topic pages were unavailable and not used. No hashtag volume or reach claims are made.
- Alt-text draft archived in CAPTIONS.md; publishing connector exposes no dedicated alt-text field, so it was not applied.
- No location or collaborator tag was applied; the publishing action exposes no fields for these.
- Instagram Story: not created or published; no separate 1080 × 1920 asset.
- Reel: not published; no authentic user-owned or licensed MP4/MOV was available. A 22–25 second script and shot list are saved in REEL-SCRIPT.md.

## Final slot result
Exactly one campaign created. One Instagram image post confirmed by media history and public permalink. One Facebook photo post confirmed by write response and public permalink. No carousel, extra feed post, duplicate, draft, future queue, Story or Reel was created.
