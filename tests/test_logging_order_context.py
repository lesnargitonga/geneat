"""Order correlation fields on structlog context."""
from __future__ import annotations

import json
import logging
from io import StringIO
from uuid import uuid4

import structlog

from app.core.logging import configure_logging, get_logger, order_log_context, order_id_ctx


def test_order_log_context_binds_fields():
    configure_logging("INFO", log_format="json")
    order_id = uuid4()
    buf = StringIO()
    handler = logging.StreamHandler(buf)
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)

    log = get_logger("test.order_ctx")
    with order_log_context(order_id=order_id, public_reference="HN-ORD-DEADBEEF"):
        log.info("payment_test_event")

    line = buf.getvalue().strip().splitlines()[-1]
    payload = json.loads(line)
    assert payload["order_id"] == str(order_id)
    assert payload["public_reference"] == "HN-ORD-DEADBEEF"
    assert order_id_ctx.get() is None
