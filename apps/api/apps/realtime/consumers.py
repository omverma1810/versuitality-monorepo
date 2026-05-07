"""WebSocket consumers for the live order board."""
from __future__ import annotations

from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.utils import timezone


ORDER_BOARD_GROUP = 'orders.board'


class OrderBoardConsumer(AsyncJsonWebsocketConsumer):
    """Subscribes the connected user to live order events.

    Events sent over the wire (envelope shape):
        { kind: 'order_created' | 'order_status_changed' | 'order_updated',
          order: <serialized OrderListItem-shaped dict>,
          previous_status?: str,
          actor?: { id, full_name, role },
          reason?: str,
          at: iso8601 }
    """

    async def connect(self):
        user = self.scope.get('user')
        if not user or not getattr(user, 'is_authenticated', False) or not user.is_active:
            await self.close(code=4401)
            return
        await self.channel_layer.group_add(ORDER_BOARD_GROUP, self.channel_name)
        await self.accept()
        await self.send_json(
            {
                'kind': 'hello',
                'role': user.role,
                'server_time': timezone.now().isoformat(),
            }
        )

    async def disconnect(self, code):
        await self.channel_layer.group_discard(ORDER_BOARD_GROUP, self.channel_name)

    # ------------------------------------------------------------------
    # Channel-layer message handlers (called via group_send type='order.event')
    # ------------------------------------------------------------------
    async def order_event(self, event):
        await self.send_json(event['payload'])
