"""Dev / no-creds fallback providers.

These succeed by design — they exist so the rest of the system (Notification
rows, status, downstream UI surfaces) can be exercised end-to-end without
external services. Output is logged at INFO so it shows up in `docker compose
logs api`.
"""
from __future__ import annotations

import logging
import uuid

from .base import NotificationProvider, ProviderResult

logger = logging.getLogger('apps.notifications.console')


class _ConsoleProviderBase(NotificationProvider):
    channel_label: str = ''

    def send(self, *, to, body, subject='', metadata=None):
        marker = f'[{self.channel_label}→{to}]'
        if subject:
            logger.info('%s %s\n%s', marker, subject, body)
        else:
            logger.info('%s\n%s', marker, body)
        return ProviderResult(
            success=True,
            message_id=f'console-{uuid.uuid4().hex[:10]}',
            raw={'simulated': True, 'channel': self.channel_label},
        )


class ConsoleEmailProvider(_ConsoleProviderBase):
    name = 'console:email'
    channel_label = 'email'


class ConsoleWhatsAppProvider(_ConsoleProviderBase):
    name = 'console:whatsapp'
    channel_label = 'whatsapp'
