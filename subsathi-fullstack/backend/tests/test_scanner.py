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