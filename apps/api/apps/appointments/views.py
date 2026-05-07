from __future__ import annotations

from datetime import datetime, time, timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsAuthenticatedActive

from .models import Appointment, AppointmentStatus
from .serializers import AppointmentSerializer, AppointmentTransitionSerializer
from .services import notify_appointment_scheduled


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.select_related('client', 'created_by').all()
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticatedActive]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        if status := params.get('status'):
            qs = qs.filter(status=status)
        if client_id := params.get('client'):
            qs = qs.filter(client_id=client_id)
        if (frm := params.get('from')):
            try:
                qs = qs.filter(scheduled_at__date__gte=datetime.fromisoformat(frm).date())
            except ValueError:
                pass
        if (to := params.get('to')):
            try:
                qs = qs.filter(scheduled_at__date__lte=datetime.fromisoformat(to).date())
            except ValueError:
                pass
        if q := params.get('q'):
            qs = qs.filter(
                Q(full_name__icontains=q)
                | Q(mobile__icontains=q)
                | Q(client__client_id__icontains=q)
            )
        return qs.order_by('scheduled_at')

    def perform_create(self, serializer):
        appt = serializer.save(created_by=self.request.user)
        notify_appointment_scheduled(appt)

    @action(detail=False, methods=['get'])
    def today(self, request):
        now = timezone.now()
        start = timezone.make_aware(datetime.combine(now.date(), time.min)) if timezone.is_naive(now) else datetime.combine(now.date(), time.min, tzinfo=now.tzinfo)
        end = start + timedelta(days=1)
        qs = (
            self.get_queryset()
            .filter(scheduled_at__gte=start, scheduled_at__lt=end)
            .exclude(status=AppointmentStatus.CANCELLED)
            .order_by('scheduled_at')
        )
        return Response(
            {
                'count': qs.count(),
                'results': AppointmentSerializer(qs, many=True).data,
            }
        )

    @action(detail=True, methods=['post'])
    def transition(self, request, pk=None):
        appt = self.get_object()
        payload = AppointmentTransitionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        appt.status = payload.validated_data['status']
        if payload.validated_data.get('notes'):
            existing = (appt.notes or '').strip()
            stamp = timezone.now().strftime('%Y-%m-%d %H:%M')
            extra = f'[{stamp}] {payload.validated_data["notes"]}'
            appt.notes = (existing + '\n' + extra).strip() if existing else extra
        appt.save(update_fields=['status', 'notes', 'updated_at'])
        return Response(AppointmentSerializer(appt).data)
