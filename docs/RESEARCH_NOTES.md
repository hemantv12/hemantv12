# EarnRoute product and technical research notes

Research date: 19 October 2026  
Repository target: hemantv12/hemantv12, branch earnroute-production  
Scope: public product information and official technical/government guidance. This is not legal advice, a paid-account competitor audit, or independent verification of competitors' marketing metrics.

## Competitor patterns and the EarnRoute opportunity

### WorkIndia

The public WorkIndia candidate app page describes free job discovery, blue/grey-collar roles across India, Hindi and English, direct HR contact, location/skill-based alerts, candidate reviews and a resume builder. Source: https://www.workindia.in/app/

Product implication: localisation, simple onboarding and a clear warning against recruitment fees are table stakes. EarnRoute should not compete only by adding filters. Its differentiator should be genuine short shifts with explicit start/end times, business-set workplace pins, capacity checks, schedule-conflict protection and clear pay/commute estimates before a worker applies.

### Job Hai

Job Hai's public About page describes local jobs, employer verification, direct HR contact, smart filters and broad city/category coverage. Source: https://www.jobhai.com/about-us

Product implication: trust state must be accurate and auditable. A verified badge must mean the platform completed a defined review, not merely that a profile exists. Short-shift listing quality, explicit payment terms and hiding expired/paused shifts should outrank vanity metrics.

### Apna Employer

Apna's employer site advertises AI-assisted calling, screening/shortlisting and smart job matching. Source: https://employer.apna.co/

Product implication: AI should be a measured hiring aid, not decorative branding. EarnRoute currently uses deterministic matching and validation; do not claim an AI provider is active until credentials, server-side integration, cost limits, failure fallbacks and data-use boundaries are configured. Start with explainable checks for missing/contradictory job details and flag suspicious posts for human review rather than automatically accusing an employer of fraud.

## India-first trust and privacy

- National Career Service states that it does not charge at registration, job application or interview processing, and advises jobseekers not to pay fees to employers. Source: https://www.ncs.gov.in/ . Keep the app's warning useful, but do not imply that NCS certifies EarnRoute or any listed job.
- The official National Cyber Crime Reporting Portal directs people to 1930 for reporting online financial fraud. Source: https://cybercrime.gov.in/
- India's official Emergency Response Support System identifies 112 as its pan-India emergency number. Sources: https://112.gov.in/ and https://112.gov.in/about . EarnRoute's telephone shortcut is not an app-generated SOS, does not transmit the user's location to emergency services and does not guarantee dispatch.
- MeitY lists the Digital Personal Data Protection Rules, 2025 as notified on 14 November 2025. Source: https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025 . The official Gazette notification G.S.R. 846(E) describes phased commencement: Rules 1, 2 and 17–21 on publication; Rule 4 one year after publication; Rules 3, 5–16, 22 and 23 eighteen months after publication. Source: https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf . The exact provisions and timelines applicable to EarnRoute, the operating entity's role, notices, rights handling, retention and grievance process must be verified with qualified Indian counsel. This product work is not a declaration of statutory compliance.
- Account data currently includes account/profile details, jobs, applications, assignments, saved shifts, notifications, support conversations, reviews and audit events. The self-service export is designed to exclude password hashes/session tokens and to limit result sections. Nearby search can use GPS or a manually selected centre; the centre is sent to EarnRoute for matching and kept in temporary device session storage for up to 30 minutes. This is not continuous background tracking.
- Export and privacy requests must have an operational owner. Deletion should not be an automatic cascade that destroys dispute, assignment, fraud-prevention or audit records; each request needs a documented review process and a retention decision appropriate to the record.

## Map usage and Android layout

### OpenStreetMap raster tiles

The OpenStreetMap Foundation tile policy requires the canonical HTTPS tile endpoint, visible attribution, a valid app-identifying User-Agent for native apps, cache-respecting behaviour and no bulk prefetch/offline archive generation on its community tile server. Availability is best-effort and the Foundation provides no SLA or guarantee. Source: https://operations.osmfoundation.org/policies/tiles/

Current code has configurable provider URL metadata, visible attribution and a report-a-map-issue link, and identifies the Android app when making tile requests. Before meaningful commercial scale, choose a suitable contracted or self-hosted provider whose terms, capacity and SLA fit expected traffic. Do not use the public community tile server as an unlimited production CDN and do not add offline tile downloads under its current policy.

### Android edge-to-edge and insets

Android documents edge-to-edge layout and system-bar inset handling in its official design guidance: https://developer.android.com/design/ui/mobile/guides/layout-and-content/edge-to-edge

The existing Android container uses a WebView with native window-inset handling. Automated layout/source tests cannot guarantee visual fit on all real devices. Test both gesture and three-button navigation, small and large fonts, keyboard visibility, different display cut-outs and Hindi text on real phones/emulators.

## Product priorities derived from the research

1. Trust before volume: genuine listings, an auditable verification process, clear shift terms, expiry/cancellation states and suspicious-job reporting.
2. Economics before vanity metrics: distinguish gross pay, estimated take-home, hourly comparison and transport budget; travel calculations must remain explicit estimates rather than road ETAs or fare quotes.
3. Localisation before feature sprawl: simple Hindi/English onboarding, robust mobile typography and accessible forms/errors. Do not translate job titles or user-entered content as if they were interface strings.
4. Privacy by default: minimise precise-location retention; let users inspect their data; never export password hashes/session tokens; keep access/correction/deletion requests private and auditable.
5. Honest automation: matching, reminders, notifications, payments and AI must reflect active code/configuration. Never show fake verification, applicant counts, payouts, ratings or AI analysis.
