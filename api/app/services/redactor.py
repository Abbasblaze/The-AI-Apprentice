from __future__ import annotations

from abc import ABC, abstractmethod

from app.schemas import AppEvent, RedactionEntry, TranscriptEntry

_IMPORT_ERROR = (
    "Presidio not available: run pip install presidio-analyzer "
    "presidio-anonymizer spacy && python -m spacy download en_core_web_lg"
)


class Redactor(ABC):
    @abstractmethod
    def redact(self, text: str) -> tuple[str, list[tuple[str, int]]]: ...


_PLACEHOLDERS = {
    "PERSON": "[PERSON]",
    "NAME": "[NAME]",
    "IBAN": "[IBAN]",
    "VAT_ID": "[VAT_ID]",
    "EMAIL_ADDRESS": "[EMAIL]",
    "PHONE_NUMBER": "[PHONE]",
}

_IBAN_PATTERNS = [
    r"\bDE\d{2}(?:\s?\d{4}){4}\s?\d{2}\b",
    r"\bCH\d{2}(?:\s?[A-Z0-9]){17}\b",
    r"\bAT\d{2}(?:\s?\d{4}){4}\b",
    r"\bNL\d{2}\s?[A-Z]{4}(?:\s?\d{4}){2}\s?\d{2}\b",
    r"\bFR\d{2}(?:\s?\d{4}){5}\s?\d{3}\b",
    r"\bES\d{2}(?:\s?\d{4}){5}\b",
    r"\bPL\d{2}(?:\s?\d{4}){6}\b",
]

_VAT_PATTERNS = [
    r"\bDE\d{9}\b",
    r"\bATU\d{8}\b",
    r"\bCHE-?\d{3}\.?\d{3}\.?\d{3}(?:\s?(?:MWST|TVA|IVA))?\b",
    r"\bNL\d{9}B\d{2}\b",
    r"\bFR[A-Z0-9]{2}\d{9}\b",
    r"\bES[A-Z0-9]\d{7}[A-Z0-9]\b",
    r"\bCZ\d{8,10}\b",
]

_SANDBOX_NAMES = ["Hartmann", "Meier", "Böhm", "Fischer", "Novak"]


def _build_redactor() -> Redactor:
    from presidio_analyzer import AnalyzerEngine, Pattern, PatternRecognizer, RecognizerRegistry
    from presidio_analyzer.nlp_engine import NlpEngineProvider
    from presidio_anonymizer import AnonymizerEngine
    from presidio_anonymizer.entities import OperatorConfig

    class PresidioRedactor(Redactor):
        def __init__(self) -> None:
            provider = NlpEngineProvider(
                nlp_configuration={
                    "nlp_engine_name": "spacy",
                    "models": [{"lang_code": "en", "model_name": "en_core_web_lg"}],
                }
            )
            nlp_engine = provider.create_engine()
            registry = RecognizerRegistry()
            registry.load_predefined_recognizers(nlp_engine=nlp_engine)

            iban = PatternRecognizer(
                supported_entity="IBAN",
                patterns=[
                    Pattern(name=f"iban_{i}", regex=p, score=0.9)
                    for i, p in enumerate(_IBAN_PATTERNS)
                ],
            )
            vat = PatternRecognizer(
                supported_entity="VAT_ID",
                patterns=[
                    Pattern(name=f"vat_{i}", regex=p, score=0.85)
                    for i, p in enumerate(_VAT_PATTERNS)
                ],
            )
            names = PatternRecognizer(
                supported_entity="NAME",
                patterns=[
                    Pattern(name=f"name_{i}", regex=rf"\b{n}\b", score=0.85)
                    for i, n in enumerate(_SANDBOX_NAMES)
                ],
            )
            registry.add_recognizer(iban)
            registry.add_recognizer(vat)
            registry.add_recognizer(names)

            self._analyzer = AnalyzerEngine(nlp_engine=nlp_engine, registry=registry)
            self._anonymizer = AnonymizerEngine()
            self._entities = list(_PLACEHOLDERS.keys())
            self._operators = {
                entity: OperatorConfig("replace", {"new_value": placeholder})
                for entity, placeholder in _PLACEHOLDERS.items()
            }

        def redact(self, text: str) -> tuple[str, list[tuple[str, int]]]:
            if not text.strip():
                return text, []
            results = self._analyzer.analyze(
                text=text, language="en", entities=self._entities
            )
            if not results:
                return text, []
            anonymized = self._anonymizer.anonymize(
                text=text, analyzer_results=results, operators=self._operators
            )
            counts: dict[str, int] = {}
            for item in anonymized.items:
                counts[item.entity_type] = counts.get(item.entity_type, 0) + 1
            log = sorted(counts.items(), key=lambda kv: kv[0])
            return anonymized.text, log

    return PresidioRedactor()


try:
    redactor: Redactor = _build_redactor()
except Exception as exc:
    raise RuntimeError(_IMPORT_ERROR) from exc


def _merge_counts(
    target: dict[str, int], log: list[tuple[str, int]]
) -> None:
    for entity_type, count in log:
        target[entity_type] = target.get(entity_type, 0) + count


def _to_entries(counts: dict[str, int], location: str) -> list[RedactionEntry]:
    return [
        RedactionEntry(entity_type=entity_type, count=count, location=location)
        for entity_type, count in sorted(counts.items())
    ]


def redact_text(text: str | None) -> tuple[str | None, list[tuple[str, int]]]:
    if text is None:
        return None, []
    return redactor.redact(text)


def redact_events(
    events: list[AppEvent], location: str
) -> list[RedactionEntry]:
    counts: dict[str, int] = {}
    for event in events:
        for field_name in ("subject", "field", "from_value", "to_value", "summary"):
            value = getattr(event, field_name)
            redacted, log = redact_text(value)
            if log:
                setattr(event, field_name, redacted)
                _merge_counts(counts, log)
    return _to_entries(counts, location)


def redact_transcript(
    entries: list[TranscriptEntry], location: str = "transcript"
) -> list[RedactionEntry]:
    counts: dict[str, int] = {}
    for entry in entries:
        redacted, log = redactor.redact(entry.message)
        if log:
            entry.message = redacted
            _merge_counts(counts, log)
    return _to_entries(counts, location)
