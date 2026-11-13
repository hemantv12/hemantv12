# Publishing record — 13 November 2026

## Campaign
**Don't Demo the Menu. Demo the Moment.**
- Audience: US B2B SaaS founders and product leads.
- Format: exactly one five-slide Instagram carousel; one separate Facebook cover photo post.
- No standalone second feed post was created.

## Instagram — @aagrowthstudio (17841464848354217)
- **Status: NOT PUBLISHED.**
- Action attempted once: `create_carousel_post` with the five verified JPEG URLs in slide order.
- Exact response: `Application request limit reached`.
- No media ID or permalink returned.
- Further Instagram publish attempts stopped immediately. No retry was made for this slot.
- Instagram same-day preflight read (13 Nov): zero existing media rows before the attempt.

## Facebook — AA Growth Studio (1454190361104294)
- **Status: PUBLISHED — confirmed by the connected write response.**
- Action: `create_photo_post` with slide 1 as the separate cover image and the native Facebook caption.
- Photo ID: `122104391625542560`.
- Post ID: `1454190361104294_122104391649542560`.
- Permalink pattern from returned Page ID + post ID: https://www.facebook.com/1454190361104294/posts/122104391649542560
- Browser verification of the permalink was blocked by Facebook's login wall; the connector write response explicitly returned “Published photo post”.
- Facebook same-day preflight read (13 Nov): zero existing Page post rows before the attempt.

## Creative / render QA
- Five individual SVG sources committed; each 1080 × 1350 (4:5).
- Five public wsrv.nl URLs verified in a browser: HTTP image response type `image/jpeg`, loaded successfully, each natural size 1080 × 1350.
- JPEG byte sizes were not exposed by the browser check; do not claim an independently measured byte count. Source SVGs are small vector documents.
- Exact AA symbol vector markup reused from the existing official-mark SVG in the campaign archive; shape, proportions and fills unchanged. Wordmark set as live type.
- No photos, fake product UI, clients, testimonials or performance claims.

## Metadata
- Instagram caption: 3 hashtags — #SaaS #UXDesign #ProductDesign.
- Primary keyword: B2B SaaS product demo.
- Supporting phrases: SaaS demo strategy; product demo script; software sales demo; product walkthrough; buyer workflow.
- Alt-text drafts saved in DISCOVERY.md; not auto-applied because the publish action exposes no alt-text field.
- No location tag or collaborator tags applied.
- Story reshare prompt saved in DISCOVERY.md; no Story was published.

## Final slot result
One campaign created; Facebook cover photo confirmed published; Instagram carousel not published due to rate limit. No duplicate feed post was attempted.
