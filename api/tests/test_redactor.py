from app.schemas import TranscriptEntry, TranscriptRole
from app.services.map_service import _find_quote
from app.services.redactor import redactor


def _log_dict(log: list[tuple[str, int]]) -> dict[str, int]:
    return dict(log)


def test_iban_de_detected() -> None:
    out, log = redactor.redact("Pay to DE89 3704 0044 0532 0130 00 today")
    assert "[IBAN]" in out
    assert _log_dict(log).get("IBAN") == 1


def test_iban_ch_detected() -> None:
    out, log = redactor.redact("Account CH93 0076 2011 6238 5295 7 is active")
    assert "[IBAN]" in out
    assert _log_dict(log).get("IBAN") == 1


def test_iban_at_detected() -> None:
    out, log = redactor.redact("Use AT61 1904 3002 3457 3201 for transfers")
    assert "[IBAN]" in out
    assert _log_dict(log).get("IBAN") == 1


def test_vat_de_detected() -> None:
    out, log = redactor.redact("Our VAT ID is DE123456789 for invoicing")
    assert "[VAT_ID]" in out
    assert _log_dict(log).get("VAT_ID") == 1


def test_vat_cz_detected() -> None:
    out, log = redactor.redact("The Czech VAT is CZ12345678 on the form")
    assert "[VAT_ID]" in out
    assert _log_dict(log).get("VAT_ID") == 1


def test_email_detected() -> None:
    out, log = redactor.redact("Reach me at k.fischer@hartmann-praezision.de please")
    assert "[EMAIL]" in out
    assert _log_dict(log).get("EMAIL_ADDRESS") == 1


def test_phone_detected() -> None:
    out, log = redactor.redact("Call the office on +49 89 2345678 tomorrow")
    assert "[PHONE]" in out
    assert _log_dict(log).get("PHONE_NUMBER") == 1


def test_sandbox_name_klaus_fischer() -> None:
    out, _ = redactor.redact("The supplier contact is Klaus Fischer")
    assert "Klaus" not in out
    assert "Fischer" not in out


def test_sandbox_name_jana_novak() -> None:
    out, _ = redactor.redact("Please ask Jana Novak about the hold")
    assert "Jana" not in out
    assert "Novak" not in out


def test_sandbox_name_hartmann() -> None:
    out, log = redactor.redact("Hartmann handled the escalation")
    assert "Hartmann" not in out
    assert any(entity in _log_dict(log) for entity in ("NAME", "PERSON"))


def test_log_counts_correct() -> None:
    out, log = redactor.redact(
        "Email a@b.com and c.d@example.org about the invoice"
    )
    assert _log_dict(log).get("EMAIL_ADDRESS") == 2


def test_mixed_entities() -> None:
    out, log = redactor.redact(
        "Klaus Fischer, k.fischer@hartmann.de, IBAN DE89 3704 0044 0532 0130 00"
    )
    counts = _log_dict(log)
    assert counts.get("IBAN") == 1
    assert counts.get("EMAIL_ADDRESS") == 1
    assert "[IBAN]" in out
    assert "[EMAIL]" in out


def test_empty_text_no_entries() -> None:
    out, log = redactor.redact("")
    assert out == ""
    assert log == []


def test_whitespace_text_no_entries() -> None:
    out, log = redactor.redact("   \n  ")
    assert log == []


def test_no_pii_unchanged() -> None:
    text = "The press line needs spare parts this quarter"
    out, log = redactor.redact(text)
    assert out == text
    assert log == []


def test_idempotency() -> None:
    first, _ = redactor.redact("Pay DE89 3704 0044 0532 0130 00 to the supplier")
    second, log = redactor.redact(first)
    assert second == first
    assert log == []


def test_quote_validation_after_redaction() -> None:
    redacted, _ = redactor.redact("I always ask Fischer before posting")
    entries = [
        TranscriptEntry(role=TranscriptRole.user, message=redacted, t=12.0)
    ]
    quote_t = _find_quote(redacted, entries)
    assert quote_t == 12.0
