from __future__ import annotations

from django.db import transaction
from rest_framework import status as drf_status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAuthenticatedActive, IsQA
from apps.orders.models import Order, OrderStatus
from apps.orders.serializers import OrderListSerializer
from apps.orders.transitions import transition_order

from .checklist import CHECKLIST_ITEMS
from .models import QcInspection, QcOutcome
from .serializers import (
    QcInspectionCreateSerializer,
    QcInspectionSerializer,
)


class QcChecklistDefinitionView(APIView):
    """Returns the checklist schema. Auth required so we don't leak detail."""

    permission_classes = [IsAuthenticatedActive]

    def get(self, request):
        return Response({'items': CHECKLIST_ITEMS})


class QcQueueView(APIView):
    """Orders awaiting quality inspection."""

    permission_classes = [IsAuthenticatedActive]

    def get(self, request):
        qs = (
            Order.objects.select_related('client')
            .prefetch_related('line_items')
            .filter(status=OrderStatus.READY_FOR_QC)
            .order_by('-created_at')
        )
        return Response(
            {
                'count': qs.count(),
                'results': OrderListSerializer(qs, many=True).data,
            }
        )


class QcInspectionViewSet(viewsets.ReadOnlyModelViewSet):
    """Browse historic inspections + submit new ones for the active QA queue."""

    queryset = QcInspection.objects.select_related('order', 'inspector').all()
    permission_classes = [IsAuthenticatedActive]
    serializer_class = QcInspectionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        order_id = self.request.query_params.get('order')
        if order_id:
            qs = qs.filter(order_id=order_id)
        return qs

    @action(detail=False, methods=['post'], permission_classes=[IsQA])
    def submit(self, request):
        serializer = QcInspectionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order = serializer.validated_data['_order']
        normalised = serializer.validated_data['_normalised_checklist']
        outcome = serializer.validated_data['outcome']
        comment = (serializer.validated_data.get('overall_comment') or '').strip()
        any_fail = serializer.validated_data['_any_fail']

        with transaction.atomic():
            inspection = QcInspection.objects.create(
                order=order,
                inspector=request.user,
                outcome=outcome,
                checklist=normalised,
                overall_comment=comment,
            )

            # Drive the order through its state machine. The transition layer
            # broadcasts a WS event and writes the audit entry.
            target = (
                OrderStatus.READY_FOR_DELIVERY
                if outcome == QcOutcome.PASS
                else OrderStatus.QC_REJECTED
            )
            reason = comment
            if outcome == QcOutcome.FAIL:
                failed_labels = [
                    next(
                        (i['label'] for i in CHECKLIST_ITEMS if i['key'] == k),
                        k,
                    )
                    for k, v in normalised.items()
                    if v['result'] == 'fail'
                ]
                if failed_labels:
                    summary = 'Failed: ' + ', '.join(failed_labels)
                    reason = f'{summary}. {comment}' if comment else summary
            transition_order(
                order=order,
                target=target,
                actor=request.user,
                reason=reason,
            )

        return Response(
            QcInspectionSerializer(inspection).data,
            status=drf_status.HTTP_201_CREATED,
        )
