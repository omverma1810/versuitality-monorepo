"""ASGI entry point — wraps the Django HTTP app with Channels for WebSockets."""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'versuitality.settings')

# Build the HTTP app first so the app registry is populated before importing
# anything that touches the ORM.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import OriginValidator  # noqa: E402
from django.conf import settings  # noqa: E402

from apps.realtime.auth import JWTAuthMiddleware  # noqa: E402
from apps.realtime.routing import websocket_urlpatterns  # noqa: E402

# The web app lives on a different origin than the API (e.g. Vercel vs Cloud
# Run), so the browser's Origin header is never one of ALLOWED_HOSTS. Accept the
# same origins CORS already trusts, plus the API's own hosts.
_ws_origins = list(settings.CORS_ALLOWED_ORIGINS) + [
    h for h in settings.ALLOWED_HOSTS if h != '*'
]

application = ProtocolTypeRouter(
    {
        'http': django_asgi_app,
        'websocket': OriginValidator(
            JWTAuthMiddleware(URLRouter(websocket_urlpatterns)),
            _ws_origins,
        ),
    }
)
