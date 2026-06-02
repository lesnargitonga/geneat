"""Third-party webhook payload schemas."""
from __future__ import annotations

from pydantic import BaseModel, Field


class MetaWebhookChange(BaseModel):
    value: dict = Field(default_factory=dict)
    field: str | None = None


class MetaWebhookEntry(BaseModel):
    id: str | None = None
    changes: list[MetaWebhookChange]


class MetaWebhookPayload(BaseModel):
    object: str | None = None
    entry: list[MetaWebhookEntry]

