from __future__ import annotations

import logging

from django.db import connections
from django.db.utils import OperationalError
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class HealthView(APIView):
    """Liveness probe — does the process answer HTTP at all?"""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                'status': 'ok',
                'service': 'versuitality-api',
                'time': timezone.now().isoformat(),
            }
        )


class ReadinessView(APIView):
    """Readiness probe — can the process actually serve requests?

    Pings Postgres and Redis. Returns 503 with per-dependency detail when any
    check fails so an upstream load balancer can pull this pod from rotation.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        checks: dict[str, dict] = {}

        # Postgres
        try:
            with connections['default'].cursor() as cur:
                cur.execute('SELECT 1')
                cur.fetchone()
            checks['postgres'] = {'status': 'ok'}
        except OperationalError as exc:
            checks['postgres'] = {'status': 'fail', 'detail': str(exc)[:300]}
        except Exception as exc:  # pragma: no cover - defensive
            checks['postgres'] = {'status': 'fail', 'detail': str(exc)[:300]}

        # Channel layer broker (Redis, or the single-instance in-memory layer).
        try:
            from django.conf import settings

            backend = settings.CHANNEL_LAYERS['default']['BACKEND']
            if 'InMemory' in backend:
                checks['redis'] = {
                    'status': 'skipped',
                    'detail': 'in-memory channel layer (single instance)',
                }
            else:
                import redis  # type: ignore

                if settings.REDIS_URL:
                    client = redis.Redis.from_url(
                        settings.REDIS_URL,
                        socket_connect_timeout=1.5,
                        socket_timeout=1.5,
                    )
                else:
                    client = redis.Redis(
                        host=settings.REDIS_HOST,
                        port=settings.REDIS_PORT,
                        socket_connect_timeout=1.5,
                        socket_timeout=1.5,
                    )
                client.ping()
                checks['redis'] = {'status': 'ok'}
        except Exception as exc:
            checks['redis'] = {'status': 'fail', 'detail': str(exc)[:300]}

        failed = [k for k, v in checks.items() if v['status'] == 'fail']
        body = {
            'status': 'ok' if not failed else 'fail',
            'service': 'versuitality-api',
            'time': timezone.now().isoformat(),
            'checks': checks,
        }
        code = status.HTTP_200_OK if not failed else status.HTTP_503_SERVICE_UNAVAILABLE
        return Response(body, status=code)
