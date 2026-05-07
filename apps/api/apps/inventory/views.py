from __future__ import annotations

from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsAuthenticatedActive

from .models import Fabric, FabricUsage
from .serializers import (
    FabricAdjustSerializer,
    FabricSerializer,
    FabricUsageSerializer,
)
from .services import adjust_stock


class FabricViewSet(viewsets.ModelViewSet):
    queryset = Fabric.objects.all()
    serializer_class = FabricSerializer
    permission_classes = [IsAuthenticatedActive]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        if (active := params.get('active')) is not None:
            qs = qs.filter(is_active=active.lower() in {'1', 'true', 'yes'})
        if (low := params.get('low_stock')) and low.lower() in {'1', 'true', 'yes'}:
            qs = qs.filter(quantity_meters__lte=models_fk('low_stock_threshold'))
        if q := params.get('q'):
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(code__icontains=q)
                | Q(supplier__icontains=q)
                | Q(color__icontains=q)
                | Q(fabric_type__icontains=q)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def adjust(self, request, pk=None):
        fabric = self.get_object()
        payload = FabricAdjustSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        usage = adjust_stock(
            fabric_id=fabric.id,
            delta_meters=payload.validated_data['delta_meters'],
            kind=payload.validated_data['kind'],
            notes=payload.validated_data.get('notes', ''),
            actor=request.user,
        )
        fabric.refresh_from_db()
        return Response(
            {
                'fabric': FabricSerializer(fabric).data,
                'usage': FabricUsageSerializer(usage).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'])
    def usage(self, request, pk=None):
        fabric = self.get_object()
        qs = fabric.usage_events.select_related('actor', 'order').all()
        return Response(FabricUsageSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        qs = (
            Fabric.objects.filter(is_active=True)
            .filter(quantity_meters__lte=models_fk('low_stock_threshold'))
            .order_by('quantity_meters')
        )
        return Response(
            {
                'count': qs.count(),
                'results': FabricSerializer(qs, many=True).data,
            }
        )


class FabricUsageViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FabricUsage.objects.select_related('fabric', 'actor', 'order').all()
    serializer_class = FabricUsageSerializer
    permission_classes = [IsAuthenticatedActive]

    def get_queryset(self):
        qs = super().get_queryset()
        if fid := self.request.query_params.get('fabric'):
            qs = qs.filter(fabric_id=fid)
        if oid := self.request.query_params.get('order'):
            qs = qs.filter(order_id=oid)
        return qs


# Tiny helper so we can compare a column against another column without
# importing django.db.models.F at the top (keeps the rest of the file lean).
def models_fk(field_name: str):
    from django.db.models import F

    return F(field_name)
