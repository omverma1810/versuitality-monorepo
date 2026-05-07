from __future__ import annotations

from django.db.models import Count, Max, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsAuthenticatedActive
from apps.measurements.exports import build_measurement_workbook

from .models import Client
from .serializers import ClientSerializer, ClientSummarySerializer
from .utils import normalise_mobile


def _annotate(qs):
    return qs.annotate(
        measurement_count=Count('measurements', distinct=True),
        last_measurement_at=Max('measurements__created_at'),
    )


class ClientViewSet(viewsets.ModelViewSet):
    """Client CRM. All authenticated active staff can read; staff/admin can write."""

    queryset = Client.objects.all()
    permission_classes = [IsAuthenticatedActive]
    serializer_class = ClientSerializer
    lookup_field = 'pk'

    def get_queryset(self):
        return _annotate(super().get_queryset())

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def search(self, request):
        """Global search across name, mobile, client ID."""
        q = request.query_params.get('q', '').strip()
        limit = min(int(request.query_params.get('limit', 8) or 8), 25)
        if not q:
            return Response({'results': []})

        digits_only = ''.join(ch for ch in q if ch.isdigit())
        clauses = (
            Q(full_name__icontains=q)
            | Q(client_id__icontains=q)
            | Q(email__icontains=q)
        )
        if digits_only:
            clauses |= Q(mobile__icontains=digits_only)
            if len(digits_only) >= 4:
                clauses |= Q(mobile__endswith=digits_only[-4:])

        qs = Client.objects.filter(clauses).distinct()[:limit]
        return Response({'results': ClientSummarySerializer(qs, many=True).data})

    @action(detail=False, methods=['get'])
    def by_mobile(self, request):
        """Used by the intake form to detect returning clients while typing."""
        mobile = normalise_mobile(request.query_params.get('mobile', ''))
        if not mobile or len(mobile.lstrip('+')) < 7:
            return Response({'match': None})
        try:
            client = _annotate(Client.objects.filter(mobile=mobile)).get()
        except Client.DoesNotExist:
            return Response({'match': None})
        return Response({'match': ClientSerializer(client).data})

    @action(detail=True, methods=['get'], url_path='measurements/export')
    def export_measurements(self, request, pk=None):
        client = self.get_object()
        sets = client.measurements.order_by('created_at').all()
        if not sets.exists():
            return Response(
                {'detail': 'No measurements recorded yet for this client.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        wb_bytes, filename = build_measurement_workbook(client, sets)
        from django.http import HttpResponse

        response = HttpResponse(
            wb_bytes,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
