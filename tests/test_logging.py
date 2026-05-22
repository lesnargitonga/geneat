from __future__ import annotations

import structlog

from app.core.logging import configure_logging, get_logger


def test_configure_logging_uses_named_stdlib_loggers() -> None:
    structlog.reset_defaults()
    configure_logging("INFO", "json")

    logger = get_logger("test-logger")
    logger.info("logging_boot_ok", probe=True)

