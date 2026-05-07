import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'versuitality.settings')

# Phase 4 will wrap this in a ProtocolTypeRouter for Django Channels.
application = get_asgi_application()
