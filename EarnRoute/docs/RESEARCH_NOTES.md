# EarnRoute product and technical research notes

**Research date:** 2026-10-19  
**Scope:** Existing EarnRoute repository (earnroute-production), official India guidance, public competitor product descriptions, OpenStreetMap tile policy and Android WebView layout guidance. This is product/engineering research, not legal advice.

## Existing product baseline (verified against repository source)

- Frontend: vanilla HTML/CSS/JavaScript, served at /static/*; Android WebView assets are synced from EarnRoute/app/static.
- Backend: FastAPI in app/main.py, SQLAlchemy 2, Alembic, PostgreSQL in production and SQLite in tests.
- Existing workflows include worker/business/admin roles, business verification, workplace coordinate pins, nearby distance filtering, applications/offers/assignments, saved shifts, estimated earnings/commute comparison, support tickets and role-aware mobile navigation.
- The documented launch limitations remain real blockers: payment/payout settlement is not connected end to end, email/OTP/WhatsApp providers are not configured, physical-device visual QA has not been done, and the public support email is a placeholder. A successful build alone does not mean production-ready.

## Competitor observations (publicly advertised capabilities; claims are not independently verified)

### WorkIndia
Public pages promote local and part-time jobs, direct HR contact, company verification, candidate reviews, resume help and employer candidate discovery across cities/categories. Employer pages emphasize local matching and fast post-to-candidate workflows.
- Sources: https://www.workindia.in/app/ and https://www.workindia.in/
- Product implication: make trust state explicit, keep posting simple for small businesses, and give workers useful employer/job context before applying.

### Apna
The public Google Play listing describes local/nearby search, personalized recommendations, one-tap applications, application tracking, job alerts and verified-listing claims. Its recruiter listing advertises quick job posting, hyperlocal candidate discovery and application management.
- Sources: https://play.google.com/store/apps/details?id=com.apnatime and https://play.google.com/store/apps/details?id=com.apnaemployer
- Product implication: personalized alerts and recommendations are expected category behaviours, but EarnRoute should build them on real saved preferences and actual jobs instead of mock notifications or fabricated inventory.

### Job Hai
Public pages promote local jobs, verified-job claims, direct HR contact, job alerts, language options, role categories and employer-side free posting/direct candidate contact.
- Sources: https://www.jobhai.com/about-us, https://www.jobhai.com/download-best-job-search-app-india and https://employer.jobhai.com/
- Product implication: a local-shift marketplace can differentiate with exact workplace pins, transparent pay basis/timing, schedule-conflict prevention, estimated travel trade-offs and a documented reporting workflow—not only another list of vacancies.

## India-focused official guidance

### Digital personal data protection
MeitY published the Digital Personal Data Protection Rules, 2025 in the Gazette on 13 November 2025. The notified text says Rules 1, 2 and 17–21 commence on publication; Rule 4 commences one year after publication; Rules 3, 5–16, 22 and 23 commence 18 months after publication. As of this note's date (19 October 2026), that means the one-year and 18-month dates have not both elapsed. Confirm current notifications/corrigenda and obtain legal review before making compliance claims.
- Gazette notification: https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf
- MeitY Acts and Policies: https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digit
- Engineering response: collect location only when needed, keep worker GPS ephemeral, explain the purpose, do not put precise location into analytics/logs, implement retention/deletion procedures and clear user-facing notices.

### Job-fee and cyber-fraud warnings
National Career Service says its services are free at registration, job-application and interview-processing stages; it warns jobseekers not to pay employers and points users to 1514 and the cyber-fraud helpline 1930. The National Cyber Crime Reporting Portal also directs online financial fraud reports to 1930.
- https://www.ncs.gov.in/
- https://cybercrime.gov.in/
- https://cybercrime.gov.in/Hindi/Helplinehn.aspx
- UI response: do not claim any private EarnRoute safety report alerts emergency services. Give official links and clear guidance.

### Emergency response
India's ERSS site identifies 112 as the pan-India emergency number and describes supported emergency request methods.
- https://112.gov.in/
- UI response: 112 is a user-initiated dial shortcut; EarnRoute must not represent it as a platform-dispatched SOS.

## Maps and Android

### OpenStreetMap raster tiles
The official tile policy requires the canonical https://tile.openstreetmap.org/{z}/{x}/{y}.png URL, visible attribution, a valid Referer for web traffic, suitable app identification for native clients, and respecting cache headers (or at least seven days where headers cannot be read). It forbids bulk tile downloads/offline-prefetch on the public tile service and warns that service is best-effort without an SLA, including possible blocking. The same policy recommends not hard-coding the tile URL and offers commercial provider/self-hosting alternatives.
- https://operations.osmfoundation.org/policies/tiles/
- https://operations.osmfoundation.org/policies/vector/
- Engineering response: use the canonical hostname for the free/public default, keep the URL configurable, leave Leaflet attribution visible, add a map-issue link, do not prefetch tiles, and choose a provider/self-hosted tiles before growth or service guarantees are required. A public tile server is not a commercial SLA.

### Android WebView window insets
Android documentation explains that newer Android/WebView versions adjust safe areas and keyboard-visible viewports; double padding or consuming/changing insets incorrectly can create ghost spacing or hide inputs.
- https://developer.android.com/develop/ui/views/layout/webapps/understand-window-insets
- https://developer.android.com/develop/ui/views/layout/edge-to-edge
- Engineering response: avoid duplicate system-bar padding, let WebView propagate appropriate insets, test keyboard open/close on small screens, and validate with an emulator/device rather than source assertions alone.

## Prioritized product conclusions

1. **P0 — Trustworthy map and location:** compliant tile URL/attribution/provider configuration; retain list results if tiles fail; add explicit manual area selection when GPS is denied, with chosen area and straight-line-distance caveats.
2. **P0 — Layout and navigation:** prevent header/footer/system bar/IME overlap across narrow phones and Hindi text; each control must have real functionality.
3. **P1 — High-quality job decision support:** exact pay basis and timing, transparent estimated take-home, saved search/notification workflows only when real preferences and delivery are implemented.
4. **P1 — Marketplace trust:** clear verification evidence/status, fee scam warning, private reporting, responsive moderation/support and audited admin actions.
5. **P1 — Privacy/security operations:** retention/deletion, consent/notice, data access ownership checks, shared rate limiter before multi-instance scale, logs/alerts/restore drills, privacy/legal review.
6. **P2 — Differentiation:** practical worker preference recommendations and employer shift drafting assistance; use deterministic fallbacks unless an AI provider is truly configured.
7. **Launch gates:** no real payments or payout promises without provider settlement/reconciliation, no claims of OTP/email verification without configured delivery and proof, and no Play Store release claim without production signing plus Android QA.

## Current map implementation finding

At the research baseline, the Leaflet layer used https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png and did not offer manual worker-area selection when GPS was denied. The next implementation should fix both and test the resulting UI/source path.