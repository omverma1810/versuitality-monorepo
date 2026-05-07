"""Helpers for the inventory app."""
from __future__ import annotations

import secrets


def generate_fabric_code() -> str:
    """Five-char alphanumeric fabric suffix, e.g. VS-FB-AB12C."""
    alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # avoid look-alikes
    return 'VS-FB-' + ''.join(secrets.choice(alphabet) for _ in range(5))
