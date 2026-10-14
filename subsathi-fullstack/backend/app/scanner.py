from __future__ import annotations

import base64
import html
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from email.header import decode_header as _decode_header_parts, make_header
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import urlparse, urlunparse


@dataclass(frozen=True)
class Merchant:
    name: str
    category: str
    aliases: tuple[str, ...]
    manage_url: str


MERCHANTS: tuple[Merchant, ...] = (
    Merchant("Adobe Creative Cloud", "Software", ("Adobe Creative Cloud", "Creative Cloud", "Adobe"), "https://account.adobe.com/plans"),
    Merchant("Netflix", "Entertainment", ("Netflix",), "https://www.netflix.com/YourAccount"),
    Merchant("Spotify Premium", "Music", ("Spotify Premium", "Spotify"), "https://www.spotify.com/account/overview/"),
    Merchant("Canva Pro", "Software", ("Canva Pro", "Canva"), "https://www.canva.com/settings/billing-and-teams/"),
    Merchant("YouTube Premium", "Entertainment", ("YouTube Premium",), "https://www.youtube.com/paid_memberships"),
    Merchant("Apple iCloud+", "Storage", ("iCloud+", "iCloud storage", "Apple iCloud"), "https://account.apple.com/"),
    Merchant("Amazon Prime", "Entertainment", ("Amazon Prime", "Prime membership"), "https://www.amazon.in/gp/primecentral"),
    Merchant("Google One", "Storage", ("Google One",), "https://one.google.com/settings"),
    Merchant("Microsoft 365", "Software", ("Microsoft 365", "Office 365"), "https://account.microsoft.com/services"),
    Merchant("JioHotstar", "Entertainment", ("JioHotstar", "Disney+ Hotstar", "Hotstar"), "https://www.jiohotstar.com/"),
    Merchant("ChatGPT Plus", "Software", ("ChatGPT Plus", "OpenAI ChatGPT Plus"), "https://chatgpt.com/#settings/Subscription"),
    Merchant("Dropbox Plus", "Storage", ("Dropbox Plus", "Dropbox subscription"), "https://www.dropbox.com/account/plan"),
    Merchant("Notion", "Software", ("Notion Plus", "Notion subscription"), "https://www.notion.so/settings/plans"),
    Merchant("LinkedIn Premium", "Learning", ("LinkedIn Premium",), "https://www.linkedin.com/mypreferences/d/manage-subscription"),
    Merchant("Zoom Pro", "Software", ("Zoom Pro", "Zoom Workplace Pro"), "https://zoom.us/billing"),
    Merchant("Duolingo Super", "Learning", ("Super Duolingo", "Duolingo Super"), "https://www.duolingo.com/settings/super"),
    Merchant("SonyLIV", "Entertainment", ("SonyLIV",), "https://www.sonyliv.com/"),
    Merchant("ZEE5", "Entertainment", ("ZEE5",), "https://www.zee5.com/"),
    Merchant("Figma", "Software", ("Figma Professional", "Figma"), "https://www.figma.com/settings"),
    Merchant("Amazon Music", "Music", ("Amazon Music Unlimited", "Amazon Music"), "https://www.amazon.in/music/settings"),
    Merchant("Zomato Gold", "Other", ("Zomato Gold", "Zomato Gold membership"), "https://www.zomato.com/"),
    Merchant("Swiggy One", "Other", ("Swiggy One", "Swiggy One membership"), "https://www.swiggy.com/"),
    Merchant("Apple Music", "Music", ("Apple Music",), "https://account.apple.com/"),
    Merchant("Audible", "Entertainment", ("Audible Premium Plus", "Audible Plus", "Audible"), "https://www.audible.in/account/overview"),
    Merchant("Grammarly Premium", "Software", ("Grammarly Premium", "Grammarly"), "https://account.grammarly.com/"),
    Merchant("GitHub Copilot", "Software", ("GitHub Copilot", "Copilot Individual"), "https://github.com/settings/copilot"),
    Merchant("Crunchyroll Premium", "Entertainment", ("Crunchyroll Premium", "Crunchyroll"), "https://www.crunchyroll.com/account/membership"),
    Merchant("Xbox Game Pass", "Entertainment", ("Xbox Game Pass Ultimate", "Xbox Game Pass"), "https://account.microsoft.com/services"),
    Merchant("Coursera Plus", "Learning", ("Coursera Plus", "Coursera subscription"), "https://www.coursera.org/account/subscriptions"),
    Merchant("YouTube Music", "Music", ("YouTube Music Premium", "YouTube Music"), "https://www.youtube.com/paid_memberships"),
    Merchant("Apple TV+", "Entertainment", ("Apple TV+", "Apple TV Plus"), "https://account.apple.com/"),
    Merchant("Amazon Kindle Unlimited", "Entertainment", ("Kindle Unlimited", "Amazon Kindle Unlimited"), "https://www.amazon.in/kindle-dbs/hz/subscribe/ku"),
    Merchant("JioSaavn Pro", "Music", ("JioSaavn Pro", "JioSaavn Plus", "JioSaavn"), "https://www.jiosaavn.com/settings"),
    Merchant("Gaana Plus", "Music", ("Gaana Plus", "Gaana Premium", "Gaana"), "https://gaana.com/"),
    Merchant("Times Prime", "Other", ("Times Prime", "TimesPrime"), "https://www.timesprime.com/"),
    Merchant("Airtel Xstream", "Entertainment", ("Airtel Xstream", "Xstream Premium"), "https://www.airtelxstream.in/"),
    Merchant("Tata Play Binge", "Entertainment", ("Tata Play Binge", "Tata Play Binge+"), "https://www.tataplaybinge.com/"),
    Merchant("Claude Pro", "Software", ("Claude Pro", "Claude Max", "Anthropic Claude"), "https://claude.ai/settings"),
    Merchant("Perplexity Pro", "Software", ("Perplexity Pro", "Perplexity subscription"), "https://www.perplexity.ai/settings/subscription"),
    Merchant("Midjourney", "Software", ("Midjourney Basic", "Midjourney Standard", "Midjourney Pro", "Midjourney"), "https://www.midjourney.com/account/"),
    Merchant("Cursor Pro", "Software", ("Cursor Pro", "Cursor Business", "Cursor subscription"), "https://cursor.com/settings"),
    Merchant("Replit Core", "Software", ("Replit Core", "Replit Pro", "Replit subscription"), "https://replit.com/account"),
    Merchant("AWS", "Software", ("AWS subscription", "AWS Support plan", "Amazon Web Services"), "https://console.aws.amazon.com/billing/home"),
    Merchant("Google Workspace", "Software", ("Google Workspace", "Workspace Business", "Google Workspace Business"), "https://admin.google.com/ac/billing/subscriptions"),
    Merchant("Proton", "Software", ("Proton Unlimited", "Proton Mail Plus", "Proton VPN Plus", "Proton subscription"), "https://account.proton.me/u/0/mail/subscriptions"),
    Merchant("NordVPN", "Software", ("NordVPN", "NordVPN Plus", "NordVPN Complete"), "https://my.nordaccount.com/dashboard/"),
    Merchant("ExpressVPN", "Software", ("ExpressVPN", "Express VPN"), "https://www.expressvpn.com/sign-in"),
    Merchant("Surfshark", "Software", ("Surfshark", "Surfshark One"), "https://my.surfshark.com/"),
    Merchant("PlayStation Plus", "Entertainment", ("PlayStation Plus", "PS Plus", "PlayStation Plus Premium"), "https://www.playstation.com/acct/management/"),
    Merchant("Nintendo Switch Online", "Entertainment", ("Nintendo Switch Online", "Nintendo Online"), "https://accounts.nintendo.com/"),
    Merchant("X Premium", "Other", ("X Premium", "Twitter Blue"), "https://x.com/settings/premium"),
    Merchant("Tinder", "Other", ("Tinder Gold", "Tinder Platinum", "Tinder Plus", "Tinder subscription"), "https://tinder.com/settings"),
    Merchant("Bumble Premium", "Other", ("Bumble Premium", "Bumble Boost", "Bumble subscription"), "https://bumble.com/settings"),
    Merchant("Headspace", "Other", ("Headspace Plus", "Headspace subscription", "Headspace"), "https://www.headspace.com/settings"),
    Merchant("Calm", "Other", ("Calm Premium", "Calm subscription"), "https://www.calm.com/app/profile"),
    Merchant("Strava", "Other", ("Strava subscription", "Strava Premium", "Strava"), "https://www.strava.com/settings/subscription"),
)

BILLING_SOURCE_MANAGEMENT_URLS: dict[str, str] = {
    "google_play": "https://play.google.com/store/account/subscriptions",
    "apple_app_store": "https://apps.apple.com/account/subscriptions",
    "paypal": "https://www.paypal.com/myaccount/autopay/",
    # UPI and bank mandates do not have one safe, universal cancellation URL.
    "upi_autopay": "",
    "bank_mandate": "",
    "provider": "",
}


def detect_billing_source(subject: str, sender: str, body: str) -> str:
    """Identify the billing platform only when transaction context supports it."""
    sender_l = decode_header(sender or "").lower()
    subject_l = decode_header(subject or "").lower()
    body_l = (body or "")[:18000].lower()
    combined = f"{subject_l}\n{sender_l}\n{body_l}"
    transaction_context = re.search(
        r"\b(receipt|invoice|order|purchase|subscription|renewal|renewed|charged|payment|billing agreement|automatic payment)\b",
        combined,
        re.I,
    )
    if not transaction_context:
        return "provider"

    sender_domain = parse_sender_domain(sender_l)
    sender_local = sender_l.split("@", 1)[0]
    play_context = re.search(
        r"(?:google\s+play|play\s+store).{0,65}(?:receipt|order|subscription|renewal|payment|purchase|charged)|"
        r"(?:receipt|order|subscription|renewal|payment|purchase|charged).{0,65}(?:google\s+play|play\s+store)|"
        r"billed\s+through\s+google\s+play|managed\s+by\s+google\s+play",
        combined,
        re.I | re.S,
    )
    if play_context or ("googleplay" in sender_local and sender_domain in {"google.com", "googlemail.com"}):
        return "google_play"

    apple_context = re.search(
        r"(?:apple\.com/bill|app\s+store|itunes(?:\s+store)?\s+receipt|billed\s+by\s+apple|"
        r"receipt\s+from\s+apple|manage\s+in\s+apple)",
        combined,
        re.I,
    )
    if apple_context and (sender_domain == "apple.com" or "apple.com" in combined or "itunes" in combined):
        return "apple_app_store"

    if _domain_matches(sender_domain, ("paypal.com",)) and re.search(
        r"\b(automatic payment|billing agreement|preapproved payment|subscription payment|manage automatic payments)\b",
        combined,
        re.I,
    ):
        return "paypal"

    if re.search(r"\b(upi\s*autopay|upi\s+mandate|e-mandate|autopay mandate|recurring upi)\b", combined, re.I):
        return "upi_autopay"
    if re.search(r"\b(e-nach|nach mandate|standing instruction|recurring card mandate|card e-mandate)\b", combined, re.I):
        return "bank_mandate"
    return "provider"


def management_url_for_source(provider_url: str, billing_source: str | None) -> str:
    source = (billing_source or "provider").strip().lower()
    platform_url = BILLING_SOURCE_MANAGEMENT_URLS.get(source)
    if platform_url is not None:
        return platform_url or (provider_url if source == "provider" else "")
    return provider_url


_MANAGE_LINK_TEXT = re.compile(r"\b(manage|subscription settings|billing settings|manage plan|cancel plan|cancel subscription|renew subscription|renew plan|account billing|my subscription)\b", re.I)
_IGNORED_LINK_TEXT = re.compile(r"\b(unsubscribe|email preferences|newsletter|privacy policy|terms of service|help center|contact support)\b", re.I)
_SENSITIVE_LINK_QUERY = re.compile(r"(?:token|session|auth|nonce|signature|password|reset|code)=", re.I)


def extract_management_link(
    payload: dict[str, Any],
    *,
    service_name: str,
    sender: str,
    billing_source: str | None = "provider",
) -> str:
    """Extract a stable provider account URL from receipt HTML without retaining one-time tokens."""
    platform_url = management_url_for_source("", billing_source)
    if platform_url:
        return platform_url
    if (billing_source or "provider") in {"upi_autopay", "bank_mandate"}:
        return ""

    sender_domain = parse_sender_domain(sender)
    normalized_name = re.sub(r"[^a-z0-9]", "", service_name.lower())
    merchant = next((item for item in MERCHANTS if re.sub(r"[^a-z0-9]", "", item.name.lower()) == normalized_name), None)
    roots = MERCHANT_SENDER_DOMAINS.get(merchant.name, ()) if merchant else ()
    allowed_domains = roots or ((sender_domain,) if sender_domain else ())
    if not allowed_domains:
        return ""

    html_parts: list[str] = []
    def walk(part: dict[str, Any]) -> None:
        mime = str(part.get("mimeType") or "").lower()
        if mime == "text/html":
            text_value = _decode_body_part(part)
            # _decode_body_part strips tags, so decode the raw HTML for anchor inspection too.
            raw_data = (part.get("body") or {}).get("data")
            if raw_data:
                try:
                    decoded = base64.urlsafe_b64decode(raw_data + "=" * (-len(raw_data) % 4)).decode("utf-8", errors="replace")
                    html_parts.append(decoded[:120000])
                except (ValueError, TypeError):
                    if text_value:
                        html_parts.append(text_value)
        for child in part.get("parts") or []:
            walk(child)
    walk(payload)
    fallback_url = merchant.manage_url if merchant else ""
    ranked: list[tuple[int, str]] = []
    for chunk in html_parts:
        for match in re.finditer(r"<a\b([^>]*?)href\s*=\s*(['\"])(.*?)\2([^>]*)>(.*?)</a\s*>", chunk, re.I | re.S):
            attrs = match.group(1) + " " + match.group(4)
            href = html.unescape(match.group(3)).strip()
            label = strip_html(match.group(5))
            if not label or _IGNORED_LINK_TEXT.search(label) or not _MANAGE_LINK_TEXT.search(label):
                continue
            parsed = urlparse(href)
            if parsed.scheme.lower() != "https" or not parsed.hostname or _SENSITIVE_LINK_QUERY.search(parsed.query):
                continue
            host = parsed.hostname.lower()
            if not any(host == root or host.endswith("." + root) for root in allowed_domains):
                continue
            # Strip tracking queries and fragments; never persist login tokens or one-time actions.
            stable_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path or "/", "", "", ""))
            priority = 3 if re.search(r"cancel subscription|cancel plan", label, re.I) else 2 if re.search(r"manage|billing|subscription settings", label, re.I) else 1
            ranked.append((priority, stable_url))
    return sorted(ranked, key=lambda item: item[0], reverse=True)[0][1] if ranked else fallback_url


CURRENCY_AMOUNT = re.compile(
    r"(?:"
    r"(?:₹|INR\b|Rs\.?|rupees?)\s*(?P<prefix_amount>\d[\d,]*(?:\.\d{1,2})?)"
    r"|(?P<suffix_amount>\d[\d,]*(?:\.\d{1,2})?)\s*(?:INR\b|Rs\.?|rupees?)"
    r")",
    re.IGNORECASE,
)
RECURRING_TERMS = re.compile(
    r"\b(subscription|subscribed|recurring|auto[- ]?renew|renew(?:al|s|ed)?|monthly|annually|annual|yearly|"
    r"per month|per year|membership|billing cycle|free trial|trial ends|plan will continue|"
    r"next (?:billing|payment|charge|renewal|debit)|debit date|will renew|will be renewed|"
    r"billed every|charged every|automatic renewal|subscription fee|auto[- ]?pay|autopay|"
    r"mandate|e[- ]?nach|standing instruction|recurring debit|scheduled debit|auto[- ]?debit)\b",
    re.IGNORECASE,
)
CYCLE_PATTERNS = (
    (re.compile(r"\b(weekly|every week|per week|billed weekly|each week|every 7 days|per 7 days)\b", re.I), "Weekly"),
    (re.compile(r"\b(quarterly|every 3 months|per quarter|for 3 months|3-month|billed quarterly|every 90 days|per 90 days)\b", re.I), "Quarterly"),
    (re.compile(r"\b(annual|annually|yearly|per year|every year|every 12 months|12-month|billed annually|billed yearly|per annum|each year|every 365 days|per 365 days)\b", re.I), "Yearly"),
    (re.compile(r"\b(monthly|every month|per month|each month|billed monthly|billed every month|every calendar month|billed every calendar month|per calendar month|billed every 30 days|every 30 days|per 30 days|every 1 month|each calendar month)\b", re.I), "Monthly"),
)
RENEWAL_DATE_CUE = r"(?:upcoming\s+(?:renewal|billing|payment|charge|invoice|bill)(?:\s+date)?|next\s+(?:renewal|billing|payment|charge|invoice|bill|debit)(?:\s+date)?|debit\s+scheduled(?:\s+date)?|autopay\s+date|renewal\s+date|billing\s+date|payment\s+date|debit\s+date|renews?(?:\s+on)?|will\s+renew(?:\s+on)?|renewal\s+on|will\s+be\s+charged\s+on|will\s+be\s+billed\s+on|payment\s+will\s+be\s+taken\s+on|next\s+payment\s+due|next\s+billing\s+due|next\s+debit\s+date|trial\s+ends?(?:\s+on)?|expires?(?:\s+on)?|subscription\s+ends?(?:\s+on)?|next\s+charge\s+date)"
RENEWAL_DATE_PATTERNS = (
    re.compile(RENEWAL_DATE_CUE + r"\s*(?:is(?:\s+due)?(?:\s+on)?|due(?:\s+on)?|scheduled(?:\s+for)?|expected(?:\s+on)?|on|:|-)?\s*(\d{4}-\d{2}-\d{2})", re.I),
    re.compile(RENEWAL_DATE_CUE + r"\s*(?:is(?:\s+due)?(?:\s+on)?|due(?:\s+on)?|scheduled(?:\s+for)?|expected(?:\s+on)?|on|:|-)?\s*([A-Za-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})", re.I),
    re.compile(RENEWAL_DATE_CUE + r"\s*(?:is(?:\s+due)?(?:\s+on)?|due(?:\s+on)?|scheduled(?:\s+for)?|expected(?:\s+on)?|on|:|-)?\s*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\.?\s+\d{4})", re.I),
    # Numeric dates are accepted only when the renewal/billing cue is explicit.
    re.compile(RENEWAL_DATE_CUE + r"\s*(?:is(?:\s+due)?(?:\s+on)?|due(?:\s+on)?|scheduled(?:\s+for)?|expected(?:\s+on)?|on|:|-)?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})", re.I),
)
RENEWAL_DATE_NO_YEAR_PATTERNS = (
    re.compile(RENEWAL_DATE_CUE + r"\s*(?:is(?:\s+due)?(?:\s+on)?|due(?:\s+on)?|scheduled(?:\s+for)?|expected(?:\s+on)?|on|:|-)?\s*([A-Za-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?)(?!\s*,?\s*\d{4})", re.I),
    re.compile(RENEWAL_DATE_CUE + r"\s*(?:is(?:\s+due)?(?:\s+on)?|due(?:\s+on)?|scheduled(?:\s+for)?|expected(?:\s+on)?|on|:|-)?\s*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\.?)(?!\s+\d{4})", re.I),
)


def decode_header(value: str) -> str:
    try:
        return str(make_header(_decode_header_parts(value or "")))
    except (LookupError, UnicodeDecodeError, ValueError):
        return value or ""


def strip_html(value: str) -> str:
    value = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", value)
    value = re.sub(r"(?i)<br\s*/?>|</p\s*>|</div\s*>|</li\s*>", "\n", value)
    value = re.sub(r"<[^>]+>", " ", value)
    return html.unescape(re.sub(r"\s+", " ", value)).strip()


def _decode_body_part(part: dict[str, Any]) -> str:
    body = (part.get("body") or {}).get("data")
    if not body:
        return ""
    try:
        data = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
        charset = (part.get("mimeType") or "").lower()
        # Gmail generally returns UTF-8 content, often with content headers not exposed in this part.
        decoded = data.decode("utf-8", errors="replace")
        return strip_html(decoded) if "text/html" in charset else decoded
    except (ValueError, TypeError):
        return ""


def extract_message_text(payload: dict[str, Any], max_chars: int = 45000) -> str:
    chunks: list[str] = []

    def walk(part: dict[str, Any]) -> None:
        if sum(len(x) for x in chunks) >= max_chars:
            return
        mime = (part.get("mimeType") or "").lower()
        if mime in {"text/plain", "text/html"}:
            piece = _decode_body_part(part)
            if piece:
                chunks.append(piece[: max_chars - sum(len(x) for x in chunks)])
        for child in part.get("parts") or []:
            walk(child)

    walk(payload)
    return "\n".join(chunks)[:max_chars]


def parse_date(value: str | None, reference_date: date | datetime | None = None) -> str | None:
    """Extract an explicitly-labelled renewal date without inventing missing fields."""
    if not value:
        return None
    value = value.strip()
    full_date_formats = (
        "%Y-%m-%d", "%B %d, %Y", "%B %d %Y", "%b %d, %Y", "%b %d %Y",
        "%d %B %Y", "%d %b %Y", "%d-%b-%Y", "%d-%B-%Y",
        "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y",
    )
    for pattern in RENEWAL_DATE_PATTERNS:
        match = pattern.search(value)
        if not match:
            continue
        raw = re.sub(r"(?i)\b(\d{1,2})(?:st|nd|rd|th)\b", r"\1", match.group(1).strip().replace(".", ""))
        for fmt in full_date_formats:
            try:
                return datetime.strptime(raw, fmt).date().isoformat()
            except ValueError:
                continue

    # Relative dates are resolved only against the email's timestamp, never today's date.
    if reference_date is None:
        return None
    reference = reference_date.date() if isinstance(reference_date, datetime) else reference_date
    relative = re.search(
        RENEWAL_DATE_CUE
        + r"\s*(?:is\s+)?(?:due\s+)?(?:on\s+)?(tomorrow|next\s+week|in\s+(\d{1,3})\s+days?|in\s+(\d{1,2})\s+weeks?)",
        value,
        re.I,
    )
    if relative:
        phrase = relative.group(1).lower()
        if phrase == "tomorrow":
            delta_days = 1
        elif phrase == "next week":
            delta_days = 7
        elif relative.group(2):
            delta_days = min(int(relative.group(2)), 366)
        else:
            delta_days = min(int(relative.group(3)) * 7, 366)
        return (reference + timedelta(days=delta_days)).isoformat()

    # If the provider omits the year, choose the next occurrence of that month/day.
    for pattern in RENEWAL_DATE_NO_YEAR_PATTERNS:
        match = pattern.search(value)
        if not match:
            continue
        raw = re.sub(r"(?i)\b(\d{1,2})(?:st|nd|rd|th)\b", r"\1", match.group(1).strip().replace(".", ""))
        for no_year_fmt in ("%B %d", "%b %d", "%d %B", "%d %b"):
            try:
                parsed = datetime.strptime(f"{raw} {reference.year}", f"{no_year_fmt} %Y").date()
            except ValueError:
                continue
            if parsed < reference:
                try:
                    parsed = parsed.replace(year=parsed.year + 1)
                except ValueError:
                    parsed = parsed.replace(year=parsed.year + 1, day=28)
            return parsed.isoformat()
    return None


def parse_amount_near(text: str, anchor: int) -> float | None:
    matches = list(CURRENCY_AMOUNT.finditer(text))
    if not matches:
        return None
    # A price shortly after the plan-name anchor is usually the subscription price.
    # Prefer it over an earlier unrelated cart/order total; use nearest-distance only
    # when no currency amount follows the matched service name.
    following = [item for item in matches if item.start() >= anchor and item.start() - anchor <= 220]
    match = min(following, key=lambda item: item.start() - anchor) if following else min(matches, key=lambda item: abs(item.start() - anchor))
    raw_amount = match.group("prefix_amount") or match.group("suffix_amount")
    try:
        amount = float(raw_amount.replace(",", ""))
    except (ValueError, AttributeError):
        return None
    return amount if 0 < amount <= 10_000_000 else None


def parse_cycle(text: str) -> str | None:
    for pattern, cycle in CYCLE_PATTERNS:
        if pattern.search(text):
            return cycle
    return None


def parse_sender_domain(sender: str) -> str:
    match = re.search(r"@([A-Za-z0-9.-]+)", sender or "")
    return match.group(1).lower() if match else ""


STRONG_RECURRING_EVIDENCE = re.compile(
    r"\b("
    r"auto[- ]?renew|automatic renewal|set to renew|will renew(?: on)?|renewal scheduled|"
    r"recurring payment|billing cycle|next (?:payment|billing|charge|renewal|debit)|"
    r"renewal(?: date)?|billing date|payment date|debit date|renewed|renews|renews on|"
    r"will be charged|charged again|billed every|charged every|"
    r"trial ends?(?: on)?|subscription (?:receipt|invoice|payment|renewal|renewed|was renewed|has been renewed|confirmed|activated)|"
    r"membership (?:renewal|renewed|extended)|you (?:have )?subscribed|"
    r"payment confirmation|payment successful|your plan renews|plan will continue|"
    r"subscription period|"
    r"auto[- ]?pay mandate|upi mandate|mandate (?:created|registered|activated|approved)|"
    r"recurring debit|scheduled debit|will be debited|debited every|automatic debit|"
    r"automatic payment|billing agreement|standing instruction|e[- ]?nach|nach mandate|"
    r"subscription is active|subscription active|membership is active|trial period"
    r")\b",
    re.IGNORECASE,
)

# Unknown providers require explicit renewal/recurrence evidence; generic invoice/payment
# wording must not become a subscription candidate on its own.
UNKNOWN_RECURRING_EVIDENCE = re.compile(
    r"\b(?:"
    r"auto[- ]?renew(?:al|s|ed|ing)?|automatic renewal|recurring (?:payment|charge|subscription)|"
    r"next (?:payment|billing|charge|renewal|debit)(?:\s+date)?|renewal date|billing date|payment date|"
    r"renew(?:s|ed)?\s+(?:on|every|each)|will renew(?:\s+on)?|set to renew|"
    r"will be charged (?:again|every|each|on)|charged again|billed every|charged every|"
    r"subscription (?:has been|was|will be) renewed|membership (?:has been|was|will be) renewed|"
    r"renewed(?:\s+\w+){0,4}\s+for\s+\d+\s+(?:days?|weeks?|months?|years?)|"
    r"subscription period|billing every\s+\d+\s+(?:days?|weeks?|months?|years?)|"
    r"auto[- ]?pay(?:\s+mandate)?|upi mandate|mandate (?:created|registered|activated|approved)|"
    r"recurring debit|scheduled debit|will be debited(?:\s+(?:again|every|on))?|debited every|"
    r"automatic debit|auto[- ]?debit|e[- ]?nach|nach mandate|standing instruction|"
    r"recurring card mandate|billed monthly|charged monthly|monthly subscription|annual subscription"
    r")\b",
    re.IGNORECASE,
)

MERCHANT_SENDER_DOMAINS: dict[str, tuple[str, ...]] = {
    "Adobe Creative Cloud": ("adobe.com",),
    "Netflix": ("netflix.com",),
    "Spotify Premium": ("spotify.com",),
    "Canva Pro": ("canva.com",),
    "YouTube Premium": ("youtube.com", "google.com"),
    "Apple iCloud+": ("apple.com", "icloud.com"),
    "Amazon Prime": ("amazon.com", "amazon.in"),
    "Google One": ("google.com", "googlemail.com"),
    "Microsoft 365": ("microsoft.com", "office.com"),
    "JioHotstar": ("hotstar.com", "jio.com"),
    "ChatGPT Plus": ("openai.com",),
    "Dropbox Plus": ("dropbox.com",),
    "Notion": ("notion.so", "notion.com"),
    "LinkedIn Premium": ("linkedin.com",),
    "Zoom Pro": ("zoom.us", "zoom.com"),
    "Duolingo Super": ("duolingo.com",),
    "SonyLIV": ("sonyliv.com",),
    "ZEE5": ("zee5.com",),
    "Figma": ("figma.com",),
    "Amazon Music": ("amazon.com", "amazon.in"),
    "Zomato Gold": ("zomato.com",),
    "Swiggy One": ("swiggy.com",),
    "Apple Music": ("apple.com",),
    "Audible": ("audible.com", "audible.in"),
    "Grammarly Premium": ("grammarly.com",),
    "GitHub Copilot": ("github.com",),
    "Crunchyroll Premium": ("crunchyroll.com",),
    "Xbox Game Pass": ("xbox.com", "microsoft.com"),
    "Coursera Plus": ("coursera.org",),
    "YouTube Music": ("youtube.com", "google.com"),
    "Apple TV+": ("apple.com",),
    "Amazon Kindle Unlimited": ("amazon.com", "amazon.in"),
    "JioSaavn Pro": ("jiosaavn.com",),
    "Gaana Plus": ("gaana.com",),
    "Times Prime": ("timesprime.com",),
    "Airtel Xstream": ("airtel.in",),
    "Tata Play Binge": ("tataplaybinge.com", "tataplay.com"),
    "Claude Pro": ("anthropic.com",),
    "Perplexity Pro": ("perplexity.ai",),
    "Midjourney": ("midjourney.com",),
    "Cursor Pro": ("cursor.com",),
    "Replit Core": ("replit.com",),
    "AWS": ("amazon.com", "amazonaws.com", "aws.amazon.com"),
    "Google Workspace": ("google.com", "workspace.google.com"),
    "Proton": ("proton.me", "protonmail.com"),
    "NordVPN": ("nordvpn.com",),
    "ExpressVPN": ("expressvpn.com",),
    "Surfshark": ("surfshark.com",),
    "PlayStation Plus": ("playstation.com",),
    "Nintendo Switch Online": ("nintendo.com",),
    "X Premium": ("x.com", "twitter.com"),
    "Tinder": ("gotinder.com", "tinder.com"),
    "Bumble Premium": ("bumble.com",),
    "Headspace": ("headspace.com",),
    "Calm": ("calm.com",),
    "Strava": ("strava.com",),
}


def _domain_matches(domain: str, roots: tuple[str, ...]) -> bool:
    return bool(domain) and any(domain == root or domain.endswith("." + root) for root in roots)


HEADER_TRANSACTION_CUES = re.compile(
    r"\b(receipt|invoice|payment|bill(?:ing)?|renewal|renewed|renews?|renewing|subscription|membership|"
    r"trial ends?|charge|charged|auto[- ]?renew\w*|recurring payment|billing cycle|purchase|will be charged)\b",
    re.IGNORECASE,
)
HEADER_PROVIDER_CONTEXT = re.compile(
    r"\b(plan|premium|membership|subscription|billing|payment|renewal|renewed|receipt|"
    r"invoice|order|charge|trial|account|purchase|auto[- ]?renew|recurring)\b",
    re.IGNORECASE,
)
HEADER_MARKETING_SUBJECT = re.compile(
    r"\b(newsletter|weekly picks|weekend music picks|week in review|product update|what'?s new|new features?|"
    r"special offers?|promo(?:tion)?s?|discounts?|deals?|webinar|event invitation|"
    r"recommended for you|trending now|top picks)\b",
    re.IGNORECASE,
)


def should_fetch_full_message(subject: str, sender: str) -> bool:
    """Fetch plausible billing mail, including provider messages with generic welcome subjects."""
    decoded_subject = decode_header(subject or "")
    decoded_sender = decode_header(sender or "")
    if HEADER_TRANSACTION_CUES.search(decoded_subject):
        return True
    domain = parse_sender_domain(decoded_sender)
    known_provider = any(
        _domain_matches(domain, roots)
        for roots in MERCHANT_SENDER_DOMAINS.values()
    )
    if not known_provider:
        return False
    # Provider onboarding/confirmation mail can say only "Welcome" in the subject,
    # with the actual plan, trial or recurring terms in the body. Search queries already
    # constrain these messages to billing-related terms; avoid obvious marketing blasts.
    return not bool(HEADER_MARKETING_SUBJECT.search(decoded_subject))


def parse_billing_message(*, message_id: str, subject: str, sender: str, date_header: str, body: str) -> dict[str, Any] | None:
    """Extract a likely recurring subscription from a billing/renewal email.

    Marketing and one-off purchase emails are rejected unless they contain a
    strong transaction/renewal cue. Full message content is never returned.
    """
    subject = decode_header(subject or "")
    sender = decode_header(sender or "")
    combined = f"{subject}\n{body}"[:50000]
    # Cheap first-pass filter; words like "monthly" alone are not sufficient evidence.
    if not RECURRING_TERMS.search(combined) or not STRONG_RECURRING_EVIDENCE.search(combined):
        return None

    sender_lower = sender.lower()
    sender_domain = parse_sender_domain(sender)
    subject_lower = subject.lower()
    match_info: tuple[Merchant, int] | None = None
    match_identity_confident = False
    match_anchor = len(subject) + 1

    # Prefer a service named in the subject, then a trusted provider sender,
    # then a body mention. This avoids picking a brand from a footer/advert.
    for merchant in MERCHANTS:
        domains = MERCHANT_SENDER_DOMAINS.get(merchant.name, ())
        sender_trusted = _domain_matches(sender_domain, domains)
        sender_brand = any(alias.lower() in sender_lower for alias in merchant.aliases)
        subject_positions = [
            match.start() for alias in merchant.aliases
            if (match := re.search(re.escape(alias), subject, re.IGNORECASE))
        ]
        all_positions = [
            match.start() for alias in merchant.aliases
            if (match := re.search(re.escape(alias), combined, re.IGNORECASE))
        ]
        if not all_positions and sender_trusted:
            # Infer sender identity only when the sender domain maps to one service;
            # don't guess between Amazon or Google subscriptions.
            same_domain_services = [
                item for item in MERCHANTS
                if _domain_matches(sender_domain, MERCHANT_SENDER_DOMAINS.get(item.name, ()))
            ]
            if len(same_domain_services) == 1:
                all_positions = [len(subject) + 1]
        if not all_positions:
            continue
        subject_match = bool(subject_positions)
        identity_confident = subject_match or sender_trusted or sender_brand
        score = (
            -10000 if subject_match else
            -5000 if sender_trusted or sender_brand else
            0
        ) + min(subject_positions or all_positions)
        if match_info is None or score < match_info[1]:
            match_info = (merchant, score)
            match_identity_confident = identity_confident
            body_positions = [
                match.start() for alias in merchant.aliases
                if (match := re.search(re.escape(alias), body or "", re.IGNORECASE))
            ]
            # Prior code used a negative ranking score as the amount's text position,
            # which clamped every search to zero and often selected an unrelated price.
            match_anchor = len(subject) + 1 + min(body_positions) if body_positions else len(subject) + 1

    amount = parse_amount_near(combined, match_anchor)
    cycle = parse_cycle(combined)
    evidence_date = ""
    parsed_date = None
    try:
        parsed_date = parsedate_to_datetime(date_header)
        evidence_date = parsed_date.isoformat() if parsed_date else ""
    except (TypeError, ValueError, OverflowError):
        evidence_date = ""
    # Some providers omit the year in the next-renewal line. Use the email's
    # timestamp as context instead of resolving such dates against today's date.
    next_renewal = parse_date(combined, reference_date=parsed_date.date() if parsed_date else None)

    merchant = match_info[0] if match_info else None
    billing_source = detect_billing_source(subject, sender, body)
    if merchant is not None:
        # A service name buried in an unrelated email is not enough. When the
        # subject/sender doesn't identify the provider, require amount plus
        # an explicit cycle or renewal date as corroborating billing evidence.
        if not match_identity_confident and not (amount is not None and (cycle or next_renewal)):
            return None
        merchant_name, category, manage_url = merchant.name, merchant.category, merchant.manage_url
    else:
        # Unknown providers need evidence of actual recurrence, not just invoice
        # boilerplate, a one-off payment, or words in a footer.
        if not UNKNOWN_RECURRING_EVIDENCE.search(combined):
            return None
        transactional_subject = re.search(
            r"\b(receipt|invoice|payment|billing|renewal|renewed|subscription|membership|trial ends?|charge|"
            r"auto[- ]?pay|autopay|mandate|e[- ]?nach|nach|standing instruction|auto[- ]?debit|"
            r"recurring debit|scheduled debit|preapproved payment)\b",
            subject,
            re.IGNORECASE,
        )
        if not transactional_subject:
            return None
        clean_subject = re.sub(r"(?i)^(your|the)\s+", "", subject)
        clean_subject = re.sub(
            r"(?i)^(?:receipt|invoice|payment|renewal|subscription|membership|"
            r"autopay|auto[- ]?pay|upi\s+autopay|upi\s+mandate|bank\s+mandate|mandate|"
            r"e[- ]?nach|nach\s+mandate|standing\s+instruction|auto[- ]?debit|"
            r"recurring\s+debit|scheduled\s+debit)"
            r"(?:\s+(?:mandate|notice|notification|registered|created|activated|approved|successfully))*"
            r"\s*(?:for|from|to|[:#-])?\s*",
            "",
            clean_subject,
        ).strip(" \t:-")
        # Trim renewal boilerplate and duration from a real product name, e.g.
        # "Zomato Gold has been renewed successfully for 3 months" -> "Zomato Gold".
        clean_subject = re.sub(
            r"(?i)\s+(?:(?:has\s+been|was|is)\s+)?(?:successfully\s+)?(?:renewed|renewal notice|subscription renewal|billing notice|payment confirmation|subscription receipt|invoice|receipt)(?:\s+successfully)?(?:\s+for\s+\d+\s+(?:days?|weeks?|months?|years?))?.*$",
            "",
            clean_subject,
        ).strip(" \t:-")
        sender_label = sender_domain.split(".")[0].replace("-", " ").title()
        candidate_name = (clean_subject or sender_label).strip()
        if not candidate_name or len(candidate_name) > 100:
            return None
        # Reject generic subjects that do not identify a product/service.
        if candidate_name.lower() in {
            "subscription", "membership", "payment", "invoice", "receipt", "renewal", "billing",
            "confirmation", "confirmed", "successful", "success", "notification", "update",
            "notice", "account update", "payment confirmation", "payment successful",
            "transaction notice", "billing notice", "subscription notice", "autopay mandate",
            "upi autopay", "upi mandate", "bank mandate", "mandate notification", "mandate created",
            "mandate registered", "e nach", "nach mandate", "standing instruction", "auto debit",
            "auto-debit", "recurring debit", "scheduled debit", "preapproved payment",
        }:
            return None
        merchant_name, category, manage_url = candidate_name, "Other", ""

    confidence = 40
    if amount is not None:
        confidence += 18
    if cycle:
        confidence += 14
    if next_renewal:
        confidence += 14
    if match_info and match_identity_confident:
        confidence += 12
    evidence = {
        "message_id": message_id,
        "amount": amount,
        "cycle": cycle,
        "next_renewal": next_renewal,
        "evidence_date": evidence_date,
        "category": category,
        "manage_url": management_url_for_source(manage_url, billing_source),
        "billing_source": billing_source,
        "service_name": merchant_name,
        "sender_domain": sender_domain,
        "confidence": min(98, confidence),
    }
    return evidence


def group_billing_evidence(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Combine evidence by service; prefer explicit amount/date/cycle, never invent dates."""
    grouped: dict[str, list[dict[str, Any]]] = {}
    for message in messages:
        service_key = re.sub(r"[^a-z0-9]", "", str(message.get("service_name", "")).lower())
        source_key = str(message.get("billing_source") or "provider").strip().lower()
        # One service can be billed directly, through Google Play, Apple, or PayPal.
        # Those are separate actionable subscriptions and must not be merged together.
        key = service_key + "|" + source_key
        if service_key:
            grouped.setdefault(key, []).append(message)
    results: list[dict[str, Any]] = []
    for items in grouped.values():
        # Use the newest receipt as the primary record. Merge each missing field
        # from the newest message that explicitly contains it, rather than letting
        # an older receipt with all fields override a newer price or renewal date.
        items.sort(key=lambda item: (
            str(item.get("evidence_date") or ""),
            bool(item.get("amount")),
            bool(item.get("next_renewal")),
            bool(item.get("cycle")),
        ), reverse=True)
        top = dict(items[0])
        for field in ("amount", "cycle", "next_renewal"):
            top[field] = next((item.get(field) for item in items if item.get(field) not in (None, "")), None)
        top["evidence_count"] = len(items)
        top["billing_source"] = str(top.get("billing_source") or "provider")
        top["manage_url"] = management_url_for_source(str(top.get("manage_url") or ""), top["billing_source"])
        top["source_accounts"] = sorted({
            str(item.get("source_mailbox", "")).lower()
            for item in items if item.get("source_mailbox")
        })
        top["confidence"] = max(int(item.get("confidence", 35)) for item in items)
        top["needs_review"] = not bool(top.get("amount")) or not bool(top.get("next_renewal")) or not bool(top.get("cycle"))
        top["fingerprint"] = "|".join((
            re.sub(r"[^a-z0-9]", "", top["service_name"].lower()),
            str(top.get("billing_source") or "provider"),
        ))
        # Keep just one evidence date and count; never persist full email subjects or bodies.
        top.pop("message_id", None)
        top.pop("sender_domain", None)
        top.pop("source_mailbox", None)
        results.append(top)
    return sorted(results, key=lambda item: (item.get("amount") is None, item["service_name"].lower()))