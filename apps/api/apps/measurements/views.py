from __future__ import annotations

from rest_framework import viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from apps.accounts.permissions import IsAuthenticatedActive

from .models import MeasurementSet
from .serializers import MeasurementSetSerializer


class MeasurementSetViewSet(viewsets.ModelViewSet):
    queryset = MeasurementSet.objects.select_related('client', 'created_by').all()
    serializer_class = MeasurementSetSerializer
    permission_classes = [IsAuthenticatedActive]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        qs = super().get_queryset()
        client_id = self.request.query_params.get('client')
        if client_id:
            qs = qs.filter(client_id=client_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
