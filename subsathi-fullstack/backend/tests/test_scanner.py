from app.scanner import group_billing_evidence, parse_billing_message, parse_date


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
