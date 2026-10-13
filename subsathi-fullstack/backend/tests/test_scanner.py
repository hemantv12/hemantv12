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
