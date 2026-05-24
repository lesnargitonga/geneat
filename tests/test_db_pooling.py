from __future__ import annotations

import pytest

from app.core.config import get_settings


def test_db_pool_settings_present():
    s = get_settings()
    assert isinstance(s.db_pool_size, int)
    assert isinstance(s.db_max_overflow, int)
    assert s.db_pool_size >= 0
    assert s.db_max_overflow >= 0
