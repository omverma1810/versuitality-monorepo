from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ProviderResult:
    success: bool
    message_id: str = ''
    error: str = ''
    raw: dict | None = None


class NotificationProvider(ABC):
    """Pluggable transport for a single notification channel."""

    name: str = 'abstract'

    @abstractmethod
    def send(
        self,
        *,
        to: str,
        body: str,
        subject: str = '',
        metadata: dict | None = None,
    ) -> ProviderResult:
        ...
