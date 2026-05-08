"""Aggregation services for the admin analytics dashboard.

Every helper in this module returns plain dicts/lists so the views can stack
them into a single response without per-piece serializer boilerplate.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal
from statistics import mean

from django.db.models import Count, DecimalField, F, Sum
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone

from apps.crm.models import Client
from apps.orders.models import (
    PRODUCTION_FLOW,
    Order,
    OrderLineItem,
    OrderStatus,
    OrderStatusEvent,
)
from apps.qa.models import QcInspection, QcOutcome


def _zero_decimal_sum(field: str):
    """Sum that returns a Decimal('0') instead of None when the queryset is
    empty — saves the templates from worrying about nulls."""
    return Coalesce(Sum(field), Decimal('0'), output_field=DecimalField(max_digits=14, decimal_places=2))


def _date_or_none(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s).date()
    except ValueError:
        return None


def resolve_range(params) -> tuple[date, date]:
    today = timezone.localdate()
    frm = _date_or_none(params.get('from')) or today.replace(day=1)
    to = _date_or_none(params.get('to')) or today
    if frm > to:
        frm, to = to, frm
    return frm, to


def _orders_in_range(frm: date, to: date):
    return Order.objects.filter(
        created_at__date__gte=frm, created_at__date__lte=to
    )


# ---------------------------------------------------------------------------
# Range-scoped pieces
# ---------------------------------------------------------------------------


def status_distribution(frm: date, to: date) -> list[dict]:
    qs = _orders_in_range(frm, to).values('status').annotate(count=Count('id'))
    by_status = {row['status']: row['count'] for row in qs}
    # Always echo the canonical ordering so the donut renders predictably.
    return [
        {'status': s, 'count': by_status.get(s, 0)}
        for s in PRODUCTION_FLOW + [OrderStatus.QC_REJECTED]
    ]


def garment_breakdown(frm: date, to: date) -> list[dict]:
    qs = (
        OrderLineItem.objects.filter(
            order__created_at__date__gte=frm,
            order__created_at__date__lte=to,
        )
        .values('garment_type')
        .annotate(
            count=Coalesce(Sum('quantity'), 0),
            revenue=_zero_decimal_sum(F('unit_price') * F('quantity')),
        )
        .order_by('-count')
    )
    return [
        {
            'garment_type': row['garment_type'],
            'count': int(row['count'] or 0),
            'revenue': float(row['revenue'] or 0),
        }
        for row in qs
    ]


def top_clients(frm: date, to: date, *, limit: int = 8) -> list[dict]:
    qs = (
        _orders_in_range(frm, to)
        .values('client_id', 'client__client_id', 'client__full_name', 'client__mobile')
        .annotate(
            order_count=Count('id'),
            total_value=_zero_decimal_sum('subtotal'),
        )
        .order_by('-order_count', '-total_value')[:limit]
    )
    return [
        {
            'id': str(row['client_id']),
            'client_id': row['client__client_id'],
            'full_name': row['client__full_name'],
            'mobile': row['client__mobile'],
            'order_count': row['order_count'],
            'total_value': float(row['total_value'] or 0),
        }
        for row in qs
    ]


def revenue_trend(frm: date, to: date) -> list[dict]:
    """Daily totals across the requested range. Days with no orders are
    emitted as zeros so the sparkline draws a continuous line."""
    rows = (
        _orders_in_range(frm, to)
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(
            count=Count('id'),
            revenue=_zero_decimal_sum('subtotal'),
        )
        .order_by('day')
    )
    by_day = {r['day']: r for r in rows}

    out = []
    cursor = frm
    while cursor <= to:
        row = by_day.get(cursor)
        out.append(
            {
                'date': cursor.isoformat(),
                'count': int(row['count']) if row else 0,
                'revenue': float(row['revenue']) if row else 0.0,
            }
        )
        cursor += timedelta(days=1)
    return out


def stage_funnel(frm: date, to: date) -> list[dict]:
    """Average days an order spent in each status before moving on."""
    events = (
        OrderStatusEvent.objects.filter(
            order__created_at__date__gte=frm,
            order__created_at__date__lte=to,
        )
        .values('order_id', 'to_status', 'created_at')
        .order_by('order_id', 'created_at')
    )

    durations: dict[str, list[float]] = defaultdict(list)
    prev_per_order: dict[str, dict] = {}
    for ev in events:
        oid = ev['order_id']
        prev = prev_per_order.get(oid)
        if prev is not None:
            delta = (ev['created_at'] - prev['created_at']).total_seconds() / 86400.0
            durations[prev['to_status']].append(delta)
        prev_per_order[oid] = ev

    return [
        {
            'status': s,
            'avg_days': round(mean(durations[s]), 2) if durations.get(s) else None,
            'samples': len(durations.get(s, [])),
        }
        for s in PRODUCTION_FLOW
    ]


def qc_stats(frm: date, to: date) -> dict:
    qs = QcInspection.objects.filter(
        created_at__date__gte=frm, created_at__date__lte=to
    )
    total = qs.count()
    failed = qs.filter(outcome=QcOutcome.FAIL).count()
    rate = (failed / total) if total else 0.0
    return {'total': total, 'failed': failed, 'rate': round(rate, 4)}


# ---------------------------------------------------------------------------
# Headline numbers (always month-anchored, regardless of the picked range)
# ---------------------------------------------------------------------------


def month_on_month() -> dict:
    today = timezone.localdate()
    this_start = today.replace(day=1)
    last_end = this_start - timedelta(days=1)
    last_start = last_end.replace(day=1)

    def _bucket(start, end):
        agg = Order.objects.filter(
            created_at__date__gte=start, created_at__date__lte=end
        ).aggregate(c=Count('id'), s=_zero_decimal_sum('subtotal'))
        return {
            'count': agg['c'] or 0,
            'revenue': float(agg['s'] or 0),
            'from': start.isoformat(),
            'to': end.isoformat(),
        }

    current = _bucket(this_start, today)
    previous = _bucket(last_start, last_end)
    return {
        'current': current,
        'previous': previous,
        'count_delta': current['count'] - previous['count'],
        'revenue_delta': current['revenue'] - previous['revenue'],
    }


def headline_kpis() -> dict:
    today = timezone.localdate()
    return {
        'active_clients': Client.objects.count(),
        'active_orders': Order.objects.exclude(status=OrderStatus.DELIVERED).count(),
        'orders_today': Order.objects.filter(created_at__date=today).count(),
        'delivered_today': Order.objects.filter(delivered_at__date=today).count(),
    }


# ---------------------------------------------------------------------------
# Composer
# ---------------------------------------------------------------------------


def build_summary(frm: date, to: date) -> dict:
    return {
        'range': {'from': frm.isoformat(), 'to': to.isoformat()},
        'mom': month_on_month(),
        'kpis': headline_kpis(),
        'status_distribution': status_distribution(frm, to),
        'garment_breakdown': garment_breakdown(frm, to),
        'top_clients': top_clients(frm, to),
        'revenue_trend': revenue_trend(frm, to),
        'stage_funnel': stage_funnel(frm, to),
        'qc_stats': qc_stats(frm, to),
    }
