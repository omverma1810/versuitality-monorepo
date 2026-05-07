from __future__ import annotations

from rest_framework import viewsets

from apps.accounts.permissions import IsAuthenticatedActive

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only log of dispatch attempts. Filterable by ?order=<id>."""

    queryset = Notification.objects.select_related('order').all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticatedActive]

    def get_queryset(self):
        qs = super().get_queryset()
        order_id = self.request.query_params.get('order')
        if order_id:
            qs = qs.filter(order_id=order_id)
        channel = self.request.query_params.get('channel')
        if channel:
            qs = qs.filter(channel=channel)
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return qs.order_by('-created_at')
