"""Helpers for the CRM app."""
from __future__ import annotations

import re
import secrets

MOBILE_RE = re.compile(r'\D+')


def normalise_mobile(value: str) -> str:
    """Canonical E.164-style form (``+<country><number>``) so one person is one profile.

    ``9810000001``, ``09810000001``, ``98100 00001``, ``+91 98100-00001`` and
    ``0091 9810000001`` all become ``+919810000001``. Ten-digit national numbers
    get ``settings.DEFAULT_COUNTRY_CODE`` (India, 91). Anything else is assumed to
    already include its country code.
    """
    from django.conf import settings

    if not value:
        return ''
    value = value.strip()
    digits = MOBILE_RE.sub('', value)
    if not digits:
        return ''
    if value.startswith('+'):
        return '+' + digits
    if value.startswith('00'):
        return '+' + digits[2:]
    cc = getattr(settings, 'DEFAULT_COUNTRY_CODE', '91')
    if len(digits) == 10:
        return f'+{cc}{digits}'
    if len(digits) == 11 and digits.startswith('0'):
        return f'+{cc}{digits[1:]}'
    return '+' + digits


def last4(mobile: str) -> str:
    digits = MOBILE_RE.sub('', mobile or '')
    return digits[-4:] if len(digits) >= 4 else digits


def generate_client_id() -> str:
    """Six-char alphanumeric client suffix, e.g. VS-CL-AB12CD."""
    alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # avoid look-alikes
    return 'VS-CL-' + ''.join(secrets.choice(alphabet) for _ in range(6))
