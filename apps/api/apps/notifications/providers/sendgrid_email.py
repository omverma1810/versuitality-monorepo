"""SendGrid email provider — only imported when SENDGRID_API_KEY is set."""
from __future__ import annotations

import logging

from .base import NotificationProvider, ProviderResult

logger = logging.getLogger('apps.notifications.sendgrid')


class SendGridEmailProvider(NotificationProvider):
    name = 'sendgrid'

    def __init__(self, *, api_key: str, from_email: str, from_name: str) -> None:
        self.api_key = api_key
        self.from_email = from_email
        self.from_name = from_name

    def send(self, *, to, body, subject='', metadata=None):
        try:
            # Deferred import — the sendgrid SDK is heavy and rarely needed
            # in dev. Keep the runtime cost off the import path.
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Email, Mail, To

            mail = Mail(
                from_email=Email(self.from_email, self.from_name),
                to_emails=To(to),
                subject=subject or 'Versuitality',
                plain_text_content=body,
            )
            client = SendGridAPIClient(self.api_key)
            response = client.send(mail)
            message_id = ''
            try:
                # SendGrid returns the id in the X-Message-Id header.
                message_id = response.headers.get('X-Message-Id', '') if response.headers else ''
            except Exception:  # pragma: no cover - defensive
                message_id = ''
            return ProviderResult(
                success=200 <= response.status_code < 300,
                message_id=message_id,
                error='' if 200 <= response.status_code < 300 else f'HTTP {response.status_code}',
                raw={'status_code': response.status_code},
            )
        except Exception as exc:  # pragma: no cover - network / config errors
            logger.warning('SendGrid send failed', exc_info=True)
            return ProviderResult(success=False, error=str(exc)[:1000])
