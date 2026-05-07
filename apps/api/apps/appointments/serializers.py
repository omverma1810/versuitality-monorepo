from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from apps.crm.models import Client

from .models import Appointment, AppointmentKind, AppointmentStatus, NotifyVia


class AppointmentSerializer(serializers.ModelSerializer):
    client_code = serializers.CharField(source='client.client_id', read_only=True)
    is_upcoming = serializers.BooleanField(read_only=True)

    class Meta:
        model = Appointment
        fields = (
            'id',
            'client',
            'client_code',
            'full_name',
            'mobile',
            'email',
            'scheduled_at',
            'duration_minutes',
            'kind',
            'status',
            'notify_via',
            'reminder_sent_at',
            'notes',
            'is_upcoming',
            'created_at',
            'updated_at',
        )
        read_only_fields = (
            'id',
            'created_at',
            'updated_at',
            'reminder_sent_at',
            'is_upcoming',
            'client_code',
        )

    def validate_scheduled_at(self, value):
        if value < timezone.now() - timezone.timedelta(minutes=5):
            raise serializers.ValidationError(
                'Cannot schedule appointments in the past.'
            )
        return value

    def validate(self, attrs):
        client = attrs.get('client') or getattr(self.instance, 'client', None)
        # When no client is linked, contact details are required so reminders
        # can still go out.
        full_name = attrs.get('full_name') or getattr(self.instance, 'full_name', '')
        if not client and not full_name.strip():
            raise serializers.ValidationError(
                {'full_name': 'Provide a name or pick an existing client.'}
            )
        # If a client is supplied, snapshot their contact details for the
        # appointment so subsequent client edits don't rewrite history.
        if client and not attrs.get('full_name'):
            attrs['full_name'] = client.full_name
        if client and not attrs.get('mobile'):
            attrs['mobile'] = client.mobile
        if client and not attrs.get('email'):
            attrs['email'] = client.email or ''
        if attrs.get('notify_via') not in {c.value for c in NotifyVia}:
            attrs['notify_via'] = NotifyVia.BOTH
        return attrs


class AppointmentTransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            AppointmentStatus.COMPLETED,
            AppointmentStatus.CANCELLED,
            AppointmentStatus.NO_SHOW,
        ]
    )
    notes = serializers.CharField(required=False, allow_blank=True, default='')
