"""Helpers for the CRM app."""
from __future__ import annotations

import re
import secrets

MOBILE_RE = re.compile(r'\D+')


def normalise_mobile(value: str) -> str:
    """Strip everything but digits. Preserves leading + if present."""
    if not value:
        return ''
    value = value.strip()
    has_plus = value.startswith('+')
    digits = MOBILE_RE.sub('', value)
    return ('+' + digits) if has_plus else digits


def last4(mobile: str) -> str:
    digits = MOBILE_RE.sub('', mobile or '')
    return digits[-4:] if len(digits) >= 4 else digits


def generate_client_id() -> str:
    """Six-char alphanumeric client suffix, e.g. VS-CL-AB12CD."""
    alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # avoid look-alikes
    return 'VS-CL-' + ''.join(secrets.choice(alphabet) for _ in range(6))
