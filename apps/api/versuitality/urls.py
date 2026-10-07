from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve as serve_media

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('apps.core.urls')),
    path('api/', include('apps.accounts.urls')),
    path('api/', include('apps.crm.urls')),
    path('api/', include('apps.measurements.urls')),
    path('api/', include('apps.orders.urls')),
    path('api/', include('apps.qa.urls')),
    path('api/', include('apps.notifications.urls')),
    path('api/', include('apps.inventory.urls')),
    path('api/', include('apps.appointments.urls')),
    path('api/', include('apps.analytics.urls')),
]

if settings.SERVE_MEDIA_FROM_APP:
    urlpatterns += [
        re_path(
            rf'^{settings.MEDIA_URL.lstrip("/")}(?P<path>.*)$',
            serve_media,
            {'document_root': settings.MEDIA_ROOT},
        ),
    ]
