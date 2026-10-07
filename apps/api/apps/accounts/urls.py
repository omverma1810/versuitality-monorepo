from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AuditLogViewSet,
    InviteLookupView,
    LoginView,
    LogoutView,
    MeView,
    SetupPasswordView,
    UserViewSet,
)

router = DefaultRouter()
router.register('users', UserViewSet, basename='users')
router.register('audit', AuditLogViewSet, basename='audit')

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('auth/me/', MeView.as_view(), name='auth-me'),
    path('auth/setup-password/', SetupPasswordView.as_view(), name='auth-setup-password'),
    path('auth/invite/<str:token>/', InviteLookupView.as_view(), name='auth-invite-lookup'),
    path('', include(router.urls)),
]
