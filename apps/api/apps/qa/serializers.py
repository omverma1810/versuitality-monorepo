from __future__ import annotations

from rest_framework import serializers

from apps.orders.models import Order, OrderStatus

from .checklist import CHECKLIST_ITEMS, ITEM_KEYS, VALID_RESULTS
from .models import QcInspection, QcOutcome


class QcInspectionSerializer(serializers.ModelSerializer):
    inspector_name = serializers.SerializerMethodField()
    failed_items = serializers.ListField(read_only=True)

    class Meta:
        model = QcInspection
        fields = (
            'id',
            'order',
            'inspector',
            'inspector_name',
            'outcome',
            'checklist',
            'overall_comment',
            'failed_items',
            'created_at',
        )
        read_only_fields = ('id', 'inspector', 'created_at', 'inspector_name', 'failed_items')

    def get_inspector_name(self, obj):
        return obj.inspector.full_name if obj.inspector_id else 'System'


class QcInspectionCreateSerializer(serializers.Serializer):
    """Submit-shaped serializer for new QC inspections.

    Validates that every checklist item has been answered, that the outcome
    matches the responses, and that fail outcomes carry a meaningful comment
    (master needs context to start the rework).
    """

    order = serializers.UUIDField()
    outcome = serializers.ChoiceField(choices=QcOutcome.choices)
    overall_comment = serializers.CharField(required=False, allow_blank=True, default='')
    checklist = serializers.DictField(child=serializers.DictField())

    def validate(self, attrs):
        outcome = attrs['outcome']
        comment = (attrs.get('overall_comment') or '').strip()
        responses = attrs['checklist'] or {}

        # Every defined checklist item must be answered.
        missing = [k for k in ITEM_KEYS if k not in responses]
        if missing:
            raise serializers.ValidationError(
                {'checklist': f'Missing responses for: {sorted(missing)!r}'}
            )

        # Reject unknown keys to keep the dataset clean for analytics later.
        unknown = [k for k in responses if k not in ITEM_KEYS]
        if unknown:
            raise serializers.ValidationError(
                {'checklist': f'Unknown checklist keys: {sorted(unknown)!r}'}
            )

        # Each response must have a valid `result`.
        normalised: dict[str, dict] = {}
        any_fail = False
        for key in ITEM_KEYS:
            payload = responses.get(key) or {}
            result = payload.get('result')
            if result not in VALID_RESULTS:
                raise serializers.ValidationError(
                    {'checklist': f"Invalid result for '{key}': {result!r}"}
                )
            note = (payload.get('note') or '').strip()
            normalised[key] = {'result': result, 'note': note}
            if result == 'fail':
                any_fail = True

        if outcome == QcOutcome.PASS and any_fail:
            raise serializers.ValidationError(
                {
                    'outcome': 'Cannot pass an inspection with one or more failed checklist items.'
                }
            )
        if outcome == QcOutcome.FAIL and not any_fail:
            raise serializers.ValidationError(
                {
                    'outcome': 'A fail outcome needs at least one failed checklist item.'
                }
            )
        if outcome == QcOutcome.FAIL and not comment and not any(
            v['note'] for v in normalised.values()
        ):
            raise serializers.ValidationError(
                {
                    'overall_comment': 'Provide an overall comment or per-item notes so the master can rework.'
                }
            )

        # Confirm the order is currently ready for QC.
        try:
            order = Order.objects.select_related('client').get(pk=attrs['order'])
        except Order.DoesNotExist:
            raise serializers.ValidationError({'order': 'Order not found.'})
        if order.status != OrderStatus.READY_FOR_QC:
            raise serializers.ValidationError(
                {'order': f'Order is in status {order.status!r} — only ready_for_qc can be inspected.'}
            )

        attrs['_order'] = order
        attrs['_normalised_checklist'] = normalised
        attrs['_any_fail'] = any_fail
        return attrs


class QcChecklistDefinitionSerializer(serializers.Serializer):
    """Read-only metadata so the frontend can render labels consistently."""

    items = serializers.SerializerMethodField()

    def get_items(self, _obj):
        return CHECKLIST_ITEMS
