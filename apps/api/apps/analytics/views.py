from __future__ import annotations

from django.http import HttpResponse
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Role
from apps.accounts.permissions import IsAuthenticatedActive

from .exports import build_orders_workbook
from .services import build_summary, resolve_range


class _AnalyticsAccess(IsAuthenticatedActive):
    """Admin or accountant only."""

    message = 'Analytics access requires admin or accountant role.'

    def has_permission(self, request, view) -> bool:
        if not super().has_permission(request, view):
            return False
        u = request.user
        if u.is_superuser:
            return True
        return u.role in {Role.ADMIN, Role.ACCOUNTANT}


class AnalyticsSummaryView(APIView):
    permission_classes = [_AnalyticsAccess]

    def get(self, request):
        frm, to = resolve_range(request.query_params)
        return Response(build_summary(frm, to))


class AnalyticsOrdersExportView(APIView):
    permission_classes = [_AnalyticsAccess]

    def get(self, request):
        frm, to = resolve_range(request.query_params)
        data, filename = build_orders_workbook(frm, to)
        response = HttpResponse(
            data,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
