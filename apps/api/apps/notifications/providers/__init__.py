"""Provider router.

Selects an email and a WhatsApp provider based on which credentials the
deployment has configured. With nothing set we fall back to the console
provider, which logs the rendered message and stamps the Notification row
as `sent` via `console:*` so the audit trail still shows what would have
gone out the door. The moment real creds land in `.env`, the live providers
take over without any code changes.
"""
from __future__ import annotations

from django.conf import settings

from .base import NotificationProvider
from .console import ConsoleEmailProvider, ConsoleWhatsAppProvider


def _setting(key: str) -> str:
    return (getattr(settings, key, '') or '').strip()


def get_email_provider() -> NotificationProvider:
    api_key = _setting('SENDGRID_API_KEY')
    if api_key:
        # Lazy import keeps the sendgrid SDK out of the import path until it's
        # actually configured.
        from .sendgrid_email import SendGridEmailProvider

        return SendGridEmailProvider(
            api_key=api_key,
            from_email=_setting('NOTIFICATION_EMAIL_FROM') or 'orders@versuitality.com',
            from_name=_setting('NOTIFICATION_EMAIL_FROM_NAME') or 'Versuitality',
        )
    return ConsoleEmailProvider()


def get_whatsapp_provider() -> NotificationProvider:
    sid = _setting('TWILIO_ACCOUNT_SID')
    token = _setting('TWILIO_AUTH_TOKEN')
    sender = _setting('TWILIO_WHATSAPP_FROM')
    if sid and token and sender:
        from .twilio_whatsapp import TwilioWhatsAppProvider

        return TwilioWhatsAppProvider(account_sid=sid, auth_token=token, from_number=sender)
    return ConsoleWhatsAppProvider()


__all__ = ['get_email_provider', 'get_whatsapp_provider', 'NotificationProvider']
