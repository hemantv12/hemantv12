from datetime import date

from app.scanner import group_billing_evidence, parse_amount_near, parse_billing_message, parse_cycle, parse_date


def test_parse_known_recurring_service_and_amount():
    result = parse_billing_message(
        message_id="m1",
        subject="Your Spotify Premium subscription receipt",
        sender="Spotify <no-reply@spotify.com>",
        date_header="Mon, 12 Oct 2026 10:00:00 +0000",
        body="Your Spotify Premium plan renews on 2026-11-12. You will be charged ₹119 per month.",
    )
    assert result is not None
    assert result["service_name"] == "Spotify Premium"
    assert result["amount"] == 119
    assert result["cycle"] == "Monthly"
    assert result["next_renewal"] == "2026-11-12"
    assert "message_id" in result
    assert "body" not in result



def test_parse_amount_in_common_inr_formats_and_currency_after_amount():
    assert parse_amount_near("Plan amount: ₹ 1,499.00", 0) == 1499
    assert parse_amount_near("Plan amount: Rs. 799/-", 0) == 799
    assert parse_amount_near("Plan amount: 1,299 INR", 0) == 1299
    assert parse_amount_near("Plan amount: 599 rupees per month", 0) == 599


def test_parse_monthly_cycle_wording_from_billing_notice():
    assert parse_cycle("Your plan is billed every 30 days") == "Monthly"

def test_ignores_non_recurring_one_off_receipt():
    result = parse_billing_message(
        message_id="m2", subject="Your Canva design purchase receipt", sender="billing@canva.com",
        date_header="Mon, 12 Oct 2026 10:00:00 +0000", body="Thanks for purchasing an item for ₹100.",
    )
    assert result is None


def test_does_not_guess_renewal_date():
    result = parse_billing_message(
        message_id="m3", subject="Your Netflix subscription renewed", sender="billing@netflix.com",
        date_header="Mon, 12 Oct 2026 10:00:00 +0000", body="Your monthly subscription was renewed. Total charged ₹649.",
    )
    assert result is not None
    assert result["next_renewal"] is None
    grouped = group_billing_evidence([result])
    assert grouped[0]["next_renewal"] is None
    assert grouped[0]["needs_review"] is True


def test_parse_date_supported_formats():
    assert parse_date("Your plan renews on November 18, 2026") == "2026-11-18"
    assert parse_date("Trial ends on 18 Nov 2026") == "2026-11-18"
    assert parse_date("Nothing here") is None


def test_parse_renewal_date_without_year_using_email_timestamp():
    result = parse_billing_message(
        message_id="m-date-no-year",
        subject="Your Spotify Premium subscription renewal",
        sender="Spotify <no-reply@spotify.com>",
        date_header="Mon, 12 Oct 2026 10:00:00 +0000",
        body="Your Spotify Premium plan renews November 12. You will be charged ₹1,499, billed annually.",
    )
    assert result is not None
    assert result["amount"] == 1499
    assert result["cycle"] == "Yearly"
    assert result["next_renewal"] == "2026-11-12"


def test_no_year_renewal_date_rolls_forward_after_email_date():
    result = parse_billing_message(
        message_id="m-date-rollover",
        subject="Your Spotify Premium renewal notice",
        sender="Spotify <no-reply@spotify.com>",
        date_header="Fri, 20 Nov 2026 10:00:00 +0000",
        body="Your Spotify Premium plan renews on January 15. You will be charged ₹119 per month.",
    )
    assert result is not None
    assert result["next_renewal"] == "2027-01-15"


def test_no_year_renewal_date_is_not_guessed_without_reference_date():
    assert parse_date("Your plan renews on November 18") is None
    assert parse_date("Next billing date: 14/11/2026") == "2026-11-14"


def test_ignores_known_brand_marketing_email_with_generic_monthly_word():
    result = parse_billing_message(
        message_id="m4",
        subject="Canva Pro: choose a monthly plan that works for you",
        sender="Canva <news@canva.com>",
        date_header="Mon, 12 Oct 2026 10:00:00 +0000",
        body="Explore our design tools and monthly options. Start creating today.",
    )
    assert result is None


def test_requires_recurring_transaction_evidence_when_brand_only_appears_in_body():
    result = parse_billing_message(
        message_id="m5",
        subject="October product update",
        sender="updates@example.com",
        date_header="Mon, 12 Oct 2026 10:00:00 +0000",
        body="We love Spotify and our monthly newsletter. Read about music plans.",
    )
    assert result is None


def test_accepts_explicit_subscription_receipt_even_if_cycle_is_missing():
    result = parse_billing_message(
        message_id="m6",
        subject="Your Netflix subscription receipt",
        sender="Netflix <billing@netflix.com>",
        date_header="Mon, 12 Oct 2026 10:00:00 +0000",
        body="Your subscription was renewed. Total charged ₹649.",
    )
    assert result is not None
    assert result["service_name"] == "Netflix"
    assert result["amount"] == 649
    assert result["cycle"] is None
    assert result["next_renewal"] is None



def test_header_filter_keeps_transactional_and_relevant_provider_messages():
    from app.scanner import should_fetch_full_message

    assert should_fetch_full_message("Your Netflix subscription renewal receipt", "Netflix <billing@netflix.com>")
    assert should_fetch_full_message("Payment confirmation", "receipts@unknown-example.com")
    assert should_fetch_full_message("Your Spotify Premium plan", "no-reply@spotify.com")
    assert should_fetch_full_message("Netflix renews tomorrow", "billing@netflix.com")
    assert should_fetch_full_message("Welcome to Netflix", "Netflix <hello@netflix.com>")
    assert should_fetch_full_message("Your plan is ready", "Google <noreply@google.com>")
    assert should_fetch_full_message("Auto-renewal notice", "billing@unknown-example.com")


def test_header_filter_skips_unrelated_provider_newsletter():
    from app.scanner import should_fetch_full_message

    assert not should_fetch_full_message("Your weekend music picks", "news@spotify.com")
    assert not should_fetch_full_message("October company news", "updates@example.com")



def test_ignores_generic_payment_confirmation_without_identifiable_service():
    result = parse_billing_message(
        message_id="m7",
        subject="Payment confirmation",
        sender="notify@unknown-example.com",
        date_header="Mon, 12 Oct 2026 10:00:00 +0000",
        body="Your subscription payment was successful. Thank you.",
    )
    assert result is None


def test_rejects_generic_payment_invoice_without_explicit_recurring_evidence():
    result = parse_billing_message(
        message_id="m8",
        subject="Payment Invoice #0009246603 | pearlorganisation.com",
        sender="Accounts <billing@pearlorganisation.com>",
        date_header="Mon, 12 Oct 2026 10:00:00 +0000",
        body="Payment successful. Your order invoice is available in the account portal. Subscription-related help is available online.",
    )
    assert result is None


def test_extracts_product_name_and_cycle_from_explicit_three_month_renewal():
    result = parse_billing_message(
        message_id="m9",
        subject="Zomato Gold has been renewed successfully for 3 months!",
        sender="Zomato <no-reply@zomato.com>",
        date_header="Mon, 12 Oct 2026 10:00:00 +0000",
        body="Zomato Gold has been renewed successfully for 3 months!",
    )
    assert result is not None
    assert result["service_name"] == "Zomato Gold"
    assert result["cycle"] == "Quarterly"
    assert result["next_renewal"] is None



def test_price_is_selected_near_plan_name_not_first_unrelated_amount():
    result = parse_billing_message(
        message_id="anchor-1",
        subject="Your Spotify Premium subscription has renewed",
        sender="Spotify <billing@spotify.com>",
        date_header="Mon, 12 Oct 2026 10:00:00 +0000",
        body="Previous unrelated purchase total was ₹1,000. Spotify Premium subscription is ₹119 per month. Next payment date: 2026-11-12.",
    )
    assert result is not None
    assert result["service_name"] == "Spotify Premium"
    assert result["amount"] == 119.0
    assert result["cycle"] == "Monthly"
    assert result["next_renewal"] == "2026-11-12"


def test_known_provider_with_generic_subject_still_gets_body_reviewed():
    from app.scanner import should_fetch_full_message

    assert should_fetch_full_message("Thanks for your purchase", "Billing <billing@netflix.com>") is True


def test_zomato_gold_renewal_gets_real_management_url():
    result = parse_billing_message(
        message_id="zomato-1",
        subject="Zomato Gold has been renewed successfully for 3 months!",
        sender="Zomato <no-reply@zomato.com>",
        date_header="Mon, 12 Oct 2026 10:00:00 +0000",
        body="Zomato Gold has been renewed successfully for 3 months!",
    )
    assert result is not None
    assert result["service_name"] == "Zomato Gold"
    assert result["cycle"] == "Quarterly"
    assert result["manage_url"] == "https://www.zomato.com/"


def test_grouped_evidence_records_multiple_source_mailboxes():
    messages = [
        {
            "service_name": "Netflix",
            "amount": 199.0,
            "cycle": "Monthly",
            "next_renewal": "2026-11-12",
            "evidence_date": "2026-10-12T10:00:00+00:00",
            "source_mailbox": "one@gmail.com",
            "confidence": 90,
        },
        {
            "service_name": "Netflix",
            "amount": 199.0,
            "cycle": "Monthly",
            "next_renewal": None,
            "evidence_date": "2026-09-12T10:00:00+00:00",
            "source_mailbox": "two@gmail.com",
            "confidence": 75,
        },
    ]
    grouped = group_billing_evidence(messages)
    assert len(grouped) == 1
    assert grouped[0]["evidence_count"] == 2
    assert grouped[0]["source_accounts"] == ["one@gmail.com", "two@gmail.com"]


def test_detects_google_play_billing_source_and_management_url():
    from app.scanner import parse_billing_message

    result = parse_billing_message(
        message_id="play-1",
        subject="Google Play receipt: your Netflix subscription renewed",
        sender="Google Play <googleplay-noreply@google.com>",
        date_header="Mon, 12 Oct 2026 10:00:00 +0000",
        body="Netflix subscription renewed. Google Play charged ₹199 per month. Next payment date: 2026-11-12.",
    )
    assert result is not None
    assert result["service_name"] == "Netflix"
    assert result["billing_source"] == "google_play"
    assert result["manage_url"] == "https://play.google.com/store/account/subscriptions"


def test_same_service_billed_by_play_store_and_direct_are_separate():
    from app.scanner import group_billing_evidence

    grouped = group_billing_evidence([
        {"service_name": "Netflix", "billing_source": "google_play", "amount": 199, "cycle": "Monthly", "next_renewal": "2026-11-12", "confidence": 90, "source_mailbox": "a@gmail.com"},
        {"service_name": "Netflix", "billing_source": "provider", "amount": 199, "cycle": "Monthly", "next_renewal": "2026-11-12", "confidence": 90, "source_mailbox": "b@gmail.com"},
    ])
    assert len(grouped) == 2
    assert {item["billing_source"] for item in grouped} == {"google_play", "provider"}
    assert any(item["manage_url"] == "https://play.google.com/store/account/subscriptions" for item in grouped)


def test_upi_autopay_does_not_invent_a_universal_cancellation_link():
    from app.scanner import detect_billing_source, management_url_for_source

    source = detect_billing_source(
        "UPI AutoPay mandate renewed",
        "alerts@bank.example",
        "Your UPI AutoPay subscription payment was successful.",
    )
    assert source == "upi_autopay"
    assert management_url_for_source("https://merchant.example/account", source) == ""


def test_management_link_extraction_accepts_stable_provider_billing_url_only():
    import base64
    from app.scanner import extract_management_link

    def part(html_body: str) -> dict:
        return {"mimeType": "text/html", "body": {"data": base64.urlsafe_b64encode(html_body.encode()).decode().rstrip("=")}}

    safe = extract_management_link(
        {"mimeType": "text/html", "parts": [part('<a href="https://www.netflix.com/YourAccount?utm_source=receipt">Manage subscription</a>')]},
        service_name="Netflix",
        sender="billing@netflix.com",
        billing_source="provider",
    )
    assert safe == "https://www.netflix.com/YourAccount"

    unsafe = extract_management_link(
        {"mimeType": "text/html", "parts": [part('<a href="https://attacker.example/login">Manage subscription</a>')]},
        service_name="Netflix",
        sender="billing@netflix.com",
        billing_source="provider",
    )
    assert unsafe == "https://www.netflix.com/YourAccount" or unsafe == ""


def test_management_link_extraction_rejects_tokenized_one_time_urls():
    import base64
    from app.scanner import extract_management_link

    html_body = '<a href="https://www.netflix.com/YourAccount?token=one-time-secret">Manage subscription</a>'
    encoded = base64.urlsafe_b64encode(html_body.encode()).decode().rstrip("=")
    result = extract_management_link(
        {"mimeType": "text/html", "parts": [{"mimeType": "text/html", "body": {"data": encoded}}]},
        service_name="Netflix",
        sender="billing@netflix.com",
        billing_source="provider",
    )
    assert result == "https://www.netflix.com/YourAccount"


def test_latest_receipt_wins_when_price_or_renewal_changes():
    from app.scanner import group_billing_evidence

    grouped = group_billing_evidence([
        {
            "service_name": "Spotify Premium",
            "billing_source": "provider",
            "amount": 119,
            "cycle": "Monthly",
            "next_renewal": "2026-10-12",
            "evidence_date": "2026-09-12T10:00:00+00:00",
            "confidence": 95,
        },
        {
            "service_name": "Spotify Premium",
            "billing_source": "provider",
            "amount": 149,
            "cycle": "Monthly",
            "next_renewal": "2026-11-12",
            "evidence_date": "2026-10-12T10:00:00+00:00",
            "confidence": 85,
        },
    ])
    assert len(grouped) == 1
    assert grouped[0]["amount"] == 149
    assert grouped[0]["next_renewal"] == "2026-11-12"


def test_interleave_query_results_preserves_coverage_and_deduplicates():
    from app.main import _interleave_query_results

    ids = _interleave_query_results(
        [[{"id": "a"}, {"id": "b"}, {"id": "c"}], [{"id": "a"}, {"id": "x"}, {"id": "y"}]],
        5,
    )
    assert ids == ["a", "b", "x", "c", "y"]

def test_cycle_parser_handles_common_day_interval_wording():
    assert parse_cycle("Your plan renews every 7 days") == "Weekly"
    assert parse_cycle("Billed every 30 days") == "Monthly"
    assert parse_cycle("Your plan renews every 90 days") == "Quarterly"
    assert parse_cycle("Billed every 365 days") == "Yearly"


def test_date_parser_handles_due_wording_without_guessing():
    assert parse_date("Your next payment is due November 12, 2026") == "2026-11-12"
    assert parse_date("Next payment due on 2026-11-14") == "2026-11-14"
    assert parse_date("Your next payment is due soon") is None



def test_parse_ordinal_renewal_dates():
    assert parse_date("Your plan renews on November 12th, 2026") == "2026-11-12"
    assert parse_date("Next payment date is 12th Nov 2026") == "2026-11-12"
    assert parse_date("Subscription renews on 1st January 2027") == "2027-01-01"


def test_parse_relative_renewal_dates_only_from_email_timestamp():
    assert parse_date("Your plan renews tomorrow", reference_date=date(2026, 10, 12)) == "2026-10-13"
    assert parse_date("Next billing date is in 2 weeks", reference_date=date(2026, 10, 12)) == "2026-10-26"
    assert parse_date("The offer ends tomorrow") is None


def test_date_parser_handles_upcoming_bill_and_scheduled_renewal_phrasing():
    assert parse_date("Upcoming renewal: 12 Nov 2026") == "2026-11-12"
    assert parse_date("Next bill is due on 15 Dec 2026") == "2026-12-15"
    assert parse_date("Next renewal scheduled for November 20, 2026") == "2026-11-20"
    assert parse_date("Upcoming payment expected on 2026-12-01") == "2026-12-01"
    assert parse_date("Upcoming payment will happen soon") is None
