from __future__ import annotations

import base64
import html
import re
from dataclasses import dataclass
from datetime import datetime
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime
from typing import Any


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
)

CURRENCY_AMOUNT = re.compile(r"(?:₹\s*|INR\s*|Rs\.?\s*)([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)
RECURRING_TERMS = re.compile(r"\b(subscription|subscribed|recurring|auto[- ]?renew|renew(?:al|s|ed)?|monthly|annually|annual|yearly|per month|per year|membership|billing cycle|free trial|trial ends|plan will continue)\b", re.IGNORECASE)
CYCLE_PATTERNS = (
    (re.compile(r"\b(weekly|every week|per week)\b", re.I), "Weekly"),
    (re.compile(r"\b(quarterly|every 3 months|per quarter)\b", re.I), "Quarterly"),
    (re.compile(r"\b(annual|annually|yearly|per year|every 12 months|12-month)\b", re.I), "Yearly"),
    (re.compile(r"\b(monthly|every month|per month|each month)\b", re.I), "Monthly"),
)
RENEWAL_DATE_PATTERNS = (
    re.compile(r"(?:next\s+(?:renewal|billing|payment)|renewal\s+date|renews?\s+on|renewal\s+on|will\s+be\s+charged\s+on|trial\s+ends?\s+on|expires?\s+on|next\s+charge\s+date)\s*(?:is|on|:|-)?\s*(\d{4}-\d{2}-\d{2})", re.I),
    re.compile(r"(?:next\s+(?:renewal|billing|payment)|renewal\s+date|renews?\s+on|renewal\s+on|will\s+be\s+charged\s+on|trial\s+ends?\s+on|expires?\s+on)\s*(?:is|on|:|-)?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})", re.I),
    re.compile(r"(?:next\s+(?:renewal|billing|payment)|renewal\s+date|renews?\s+on|renewal\s+on|will\s+be\s+charged\s+on|trial\s+ends?\s+on|expires?\s+on)\s*(?:is|on|:|-)?\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})", re.I),
)


def decode_header(value: str) -> str:
    try:
        return str(make_header(decode_header(value or "")))
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


def parse_date(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip()
    for pattern in RENEWAL_DATE_PATTERNS:
        match = pattern.search(value)
        if match:
            raw = match.group(1).strip()
            for fmt in ("%Y-%m-%d", "%B %d, %Y", "%B %d %Y", "%b %d, %Y", "%b %d %Y", "%d %B %Y", "%d %b %Y"):
                try:
                    return datetime.strptime(raw, fmt).date().isoformat()
                except ValueError:
                    continue
    return None


def parse_amount_near(text: str, anchor: int) -> float | None:
    matches = list(CURRENCY_AMOUNT.finditer(text))
    if not matches:
        return None
    match = min(matches, key=lambda item: abs(item.start() - anchor))
    try:
        amount = float(match.group(1).replace(",", ""))
    except ValueError:
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


def parse_billing_message(*, message_id: str, subject: str, sender: str, date_header: str, body: str) -> dict[str, Any] | None:
    """Extract metadata from one email; never returns the message body or full subject."""
    combined = f"{subject}\n{body}"[:50000]
    if not RECURRING_TERMS.search(combined):
        return None
    lowered = combined.lower()
    match_info: tuple[Merchant, int] | None = None
    sender_lower = (sender or "").lower()
    for merchant in MERCHANTS:
        for alias in merchant.aliases:
            match = re.search(re.escape(alias), combined, re.I)
            if match:
                # Prefer matches in subject/body near the beginning and authoritative sender-domain matches.
                score = match.start()
                if match_info is None or score < match_info[1]:
                    match_info = (merchant, score)
                break
    merchant = match_info[0] if match_info else None
    amount = parse_amount_near(combined, match_info[1] if match_info else 0)
    cycle = parse_cycle(combined)
    next_renewal = parse_date(combined)
    evidence_date = ""
    try:
        parsed = parsedate_to_datetime(date_header)
        evidence_date = parsed.isoformat() if parsed else ""
    except (TypeError, ValueError, OverflowError):
        evidence_date = ""

    # Avoid turning a one-off product purchase into a recurring plan.
    if merchant is None:
        if not re.search(r"\b(subscription|auto[- ]?renew|recurring payment|membership renewal|your plan renews|billing cycle)\b", combined, re.I):
            return None
        # Unknown services can be suggested only when the sender/subject provides a recognisable label.
        clean_subject = re.sub(r"(?i)^(receipt|invoice|payment|renewal|subscription|order confirmation)\s*[:#-]?\s*", "", subject or "").strip()
        candidate_name = (clean_subject or parse_sender_domain(sender).split(".")[0].replace("-", " ").title()).strip()
        if not candidate_name or len(candidate_name) > 100:
            return None
        merchant_name, category, manage_url = candidate_name, "Other", ""
    else:
        merchant_name, category, manage_url = merchant.name, merchant.category, merchant.manage_url

    evidence = {
        "message_id": message_id,
        "amount": amount,
        "cycle": cycle,
        "next_renewal": next_renewal,
        "evidence_date": evidence_date,
        "category": category,
        "manage_url": manage_url,
        "service_name": merchant_name,
        "sender_domain": parse_sender_domain(sender),
    }
    # A known merchant plus a recurring indicator is a candidate even when the amount or date is absent.
    evidence["confidence"] = max(35, min(97, 65 + (12 if amount is not None else 0) + (12 if next_renewal else 0) + (8 if cycle else 0)))
    return evidence


def group_billing_evidence(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Combine evidence by service; prefer explicit amount/date/cycle, never invent dates."""
    grouped: dict[str, list[dict[str, Any]]] = {}
    for message in messages:
        key = re.sub(r"[^a-z0-9]", "", str(message.get("service_name", "")).lower())
        if key:
            grouped.setdefault(key, []).append(message)
    results: list[dict[str, Any]] = []
    for items in grouped.values():
        # Newest useful metadata first; no full messages are retained.
        items.sort(key=lambda item: (bool(item.get("amount")), bool(item.get("next_renewal")), bool(item.get("cycle")), item.get("evidence_date") or ""), reverse=True)
        top = dict(items[0])
        for field in ("amount", "cycle", "next_renewal"):
            if not top.get(field):
                top[field] = next((item.get(field) for item in items if item.get(field)), None)
        top["evidence_count"] = len(items)
        top["confidence"] = max(int(item.get("confidence", 35)) for item in items)
        top["needs_review"] = not bool(top.get("amount")) or not bool(top.get("next_renewal")) or not bool(top.get("cycle"))
        top["fingerprint"] = "|".join((re.sub(r"[^a-z0-9]", "", top["service_name"].lower()), str(top.get("amount") or "unknown"), str(top.get("cycle") or "unknown")))
        # Keep just one evidence date and count; never persist full email subjects or bodies.
        top.pop("message_id", None)
        top.pop("sender_domain", None)
        results.append(top)
    return sorted(results, key=lambda item: (item.get("amount") is None, item["service_name"].lower()))