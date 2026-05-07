"""Twilio WhatsApp provider — only imported when Twilio creds are set."""
from __future__ import annotations

import logging

from .base import NotificationProvider, ProviderResult

logger = logging.getLogger('apps.notifications.twilio')


def _whatsapp_address(value: str) -> str:
    """Normalise to Twilio's `whatsapp:+E164` format."""
    value = (value or '').strip()
    if value.startswith('whatsapp:'):
        return value
    if not value:
        return ''
    if not value.startswith('+'):
        # Best-effort default to India when the number is bare digits — staff
        # can override by storing fully-qualified numbers in the CRM.
        digits = ''.join(c for c in value if c.isdigit())
        value = '+91' + digits if not digits.startswith('91') else '+' + digits
    return f'whatsapp:{value}'


class TwilioWhatsAppProvider(NotificationProvider):
    name = 'twilio:whatsapp'

    def __init__(self, *, account_sid: str, auth_token: str, from_number: str) -> None:
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = _whatsapp_address(from_number)

    def send(self, *, to, body, subject='', metadata=None):
        try:
            from twilio.rest import Client

            client = Client(self.account_sid, self.auth_token)
            message = client.messages.create(
                body=body,
                from_=self.from_number,
                to=_whatsapp_address(to),
            )
            return ProviderResult(
                success=True,
                message_id=str(message.sid or ''),
                raw={'status': message.status},
            )
        except Exception as exc:  # pragma: no cover - network / config errors
            logger.warning('Twilio send failed', exc_info=True)
            return ProviderResult(success=False, error=str(exc)[:1000])
