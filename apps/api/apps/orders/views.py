from __future__ import annotations

from datetime import datetime, timedelta

from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status as drf_status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsAuthenticatedActive
from apps.realtime.broadcaster import order_created as broadcast_order_created

from .models import ALLOWED_TRANSITIONS, Order, OrderStatus, PRODUCTION_FLOW
from .pdf import render_order_pdf
from .serializers import (
    OrderCreateSerializer,
    OrderDetailSerializer,
    OrderListSerializer,
    OrderTransitionSerializer,
)
from .transitions import transition_order


def _annotate(qs):
    return qs.annotate(line_item_count=Count('line_items', distinct=True))


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.select_related('client', 'created_by').prefetch_related(
        'line_items', 'status_events'
    )
    permission_classes = [IsAuthenticatedActive]
    lookup_field = 'pk'

    def get_queryset(self):
        qs = _annotate(super().get_queryset())
        params = self.request.query_params

        if status := params.get('status'):
            qs = qs.filter(status=status)
        if client_id := params.get('client'):
            qs = qs.filter(client_id=client_id)
        if q := params.get('q'):
            digits = ''.join(c for c in q if c.isdigit())
            clauses = (
                Q(order_id__icontains=q)
                | Q(client__full_name__icontains=q)
            )
            if digits:
                clauses |= Q(client__mobile__icontains=digits)
            qs = qs.filter(clauses)
        if frm := params.get('from'):
            try:
                qs = qs.filter(created_at__date__gte=datetime.fromisoformat(frm).date())
            except ValueError:
                pass
        if to := params.get('to'):
            try:
                qs = qs.filter(created_at__date__lte=datetime.fromisoformat(to).date())
            except ValueError:
                pass
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return OrderCreateSerializer
        if self.action in ('retrieve',):
            return OrderDetailSerializer
        return OrderListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save(created_by=request.user)
        broadcast_order_created(order, actor=request.user)
        return Response(
            OrderDetailSerializer(order, context={'request': request}).data,
            status=drf_status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def transition(self, request, pk=None):
        order = self.get_object()
        serializer = OrderTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event = transition_order(
            order=order,
            target=serializer.validated_data['target'],
            actor=request.user,
            reason=serializer.validated_data.get('reason', ''),
        )
        return Response(
            {
                'order': OrderDetailSerializer(order, context={'request': request}).data,
                'event': {
                    'id': str(event.id),
                    'from_status': event.from_status,
                    'to_status': event.to_status,
                    'reason': event.reason,
                    'created_at': event.created_at,
                },
            }
        )

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        order = self.get_object()
        data = render_order_pdf(order)
        response = HttpResponse(data, content_type='application/pdf')
        response['Content-Disposition'] = (
            f'inline; filename="versuitality_{order.order_id}.pdf"'
        )
        return response

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = Order.objects.values('status').annotate(c=Count('id'))
        by_status = {row['status']: row['c'] for row in qs}
        total = sum(by_status.values())
        today = timezone.localdate()
        delivered_today = Order.objects.filter(
            delivered_at__date=today
        ).count()
        last_7 = Order.objects.filter(
            created_at__gte=timezone.now() - timedelta(days=7)
        ).count()
        active = total - by_status.get(OrderStatus.DELIVERED, 0)
        return Response(
            {
                'total': total,
                'active': active,
                'delivered_today': delivered_today,
                'created_last_7_days': last_7,
                'by_status': [
                    {'status': s, 'count': by_status.get(s, 0)}
                    for s in PRODUCTION_FLOW + [OrderStatus.QC_REJECTED]
                ],
            }
        )

    @action(detail=False, methods=['get'])
    def transitions_map(self, request):
        return Response(
            {k: sorted(v) for k, v in ALLOWED_TRANSITIONS.items()}
        )
