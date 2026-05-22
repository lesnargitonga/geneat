"""Domain exceptions surfaced as predictable HTTP responses."""
from __future__ import annotations


class AppError(Exception):
    status_code: int = 500
    code: str = "internal_error"

    def __init__(self, message: str = "", **extra):
        super().__init__(message)
        self.message = message or self.code
        self.extra = extra


class ValidationError(AppError):
    status_code = 422
    code = "validation_error"


class RateLimited(AppError):
    status_code = 429
    code = "rate_limited"


class SignatureInvalid(AppError):
    status_code = 401
    code = "signature_invalid"


class HumanEscalation(AppError):
    """Raised by the AI graph when a turn must be handed off to a human."""
    status_code = 200  # not an HTTP error; we still 200 the webhook
    code = "human_escalation"


class UpstreamError(AppError):
    status_code = 502
    code = "upstream_error"
