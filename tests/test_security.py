from __future__ import annotations

from app.core.security import normalize_msisdn, verify_meta_signature
import hmac, hashlib


def test_normalize_kenyan_local():
    assert normalize_msisdn("0712345678") == "+254712345678"


def test_normalize_already_e164():
    assert normalize_msisdn("+254712345678") == "+254712345678"


def test_normalize_whatsapp_prefix():
    assert normalize_msisdn("whatsapp:+254712345678") == "+254712345678"


def test_normalize_rejects_garbage():
    import pytest
    with pytest.raises(ValueError):
        normalize_msisdn("abc")


def test_meta_signature_valid():
    secret = "topsecret"
    body = b'{"hello":"world"}'
    sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert verify_meta_signature(secret, body, sig) is True
    assert verify_meta_signature(secret, body, "sha256=deadbeef") is False
    assert verify_meta_signature(secret, body, None) is False
