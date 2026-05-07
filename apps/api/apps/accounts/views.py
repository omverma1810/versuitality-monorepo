from __future__ import annotations

from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .audit import AuditAction, record
from .models import InviteToken, User
from .permissions import IsAdmin, IsAuthenticatedActive
from .serializers import (
    InviteUserSerializer,
    LoginSerializer,
    MeSerializer,
    SetupPasswordSerializer,
    UpdateUserSerializer,
    UserSerializer,
)


def _tokens_for(user: User) -> dict[str, str]:
    refresh = RefreshToken.for_user(user)
    refresh['role'] = user.role
    refresh['email'] = user.email
    refresh['full_name'] = user.full_name
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].lower().strip()
        password = serializer.validated_data['password']

        user = authenticate(request, username=email, password=password)
        if user is None or not user.is_active:
            record(AuditAction.LOGIN_FAILED, request=request, metadata={'email': email})
            return Response(
                {'detail': 'Invalid credentials or inactive account.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user.last_login = timezone.now()
        user.last_login_ip = request.META.get('REMOTE_ADDR')
        user.save(update_fields=['last_login', 'last_login_ip'])
        record(AuditAction.LOGIN, actor=user, request=request)

        return Response(
            {
                'user': MeSerializer(user).data,
                'tokens': _tokens_for(user),
            }
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticatedActive]

    def post(self, request):
        refresh = request.data.get('refresh')
        if refresh:
            try:
                RefreshToken(refresh).blacklist()
            except TokenError:
                pass  # already-invalid token: no-op
        record(AuditAction.LOGOUT, actor=request.user, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticatedActive]

    def get(self, request):
        return Response(MeSerializer(request.user).data)


class SetupPasswordView(APIView):
    """Consumes a one-time invite token and sets the user's password."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request):
        serializer = SetupPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invite: InviteToken = serializer.validated_data['invite']
        user = invite.user
        user.set_password(serializer.validated_data['password'])
        user.is_active = True
        user.save(update_fields=['password', 'is_active'])
        invite.consume()
        record(
            AuditAction.PASSWORD_SET,
            actor=user,
            target_user=user,
            request=request,
        )
        record(AuditAction.USER_ACTIVATED, target_user=user, request=request)
        return Response(
            {
                'user': MeSerializer(user).data,
                'tokens': _tokens_for(user),
            }
        )


class InviteLookupView(APIView):
    """Pre-fills the setup-password page with the invitee's name + email."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request, token: str):
        try:
            invite = InviteToken.objects.select_related('user').get(token=token)
        except InviteToken.DoesNotExist:
            return Response({'detail': 'Invalid invitation.'}, status=404)
        if not invite.is_valid:
            return Response({'detail': 'This invitation is no longer valid.'}, status=410)
        return Response(
            {
                'email': invite.user.email,
                'full_name': invite.user.full_name,
                'role': invite.user.role,
                'expires_at': invite.expires_at,
            }
        )


class UserViewSet(viewsets.ModelViewSet):
    """Admin-only user management."""

    queryset = User.objects.all().order_by('full_name')
    permission_classes = [IsAdmin]
    serializer_class = UserSerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_serializer_class(self):
        if self.action in ('partial_update', 'update'):
            return UpdateUserSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        serializer = InviteUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, invite = User.objects.invite(
            invited_by=request.user,
            **serializer.validated_data,
        )
        record(
            AuditAction.USER_INVITED,
            actor=request.user,
            target_user=user,
            request=request,
            metadata={'role': user.role},
        )
        # NOTE: Phase 6 will email the invite link. For now we surface the
        # token in the response so admins can hand it off manually in dev.
        return Response(
            {
                'user': UserSerializer(user).data,
                'invite': {
                    'token': invite.token,
                    'expires_at': invite.expires_at,
                    'setup_url': f'/setup-password?token={invite.token}',
                },
            },
            status=status.HTTP_201_CREATED,
        )

    def perform_update(self, serializer):
        previous_role = serializer.instance.role
        previous_active = serializer.instance.is_active
        instance = serializer.save()
        actor = self.request.user
        if 'role' in serializer.validated_data and previous_role != instance.role:
            record(
                AuditAction.USER_ROLE_CHANGED,
                actor=actor,
                target_user=instance,
                request=self.request,
                metadata={'from': previous_role, 'to': instance.role},
            )
        if 'is_active' in serializer.validated_data and previous_active != instance.is_active:
            record(
                AuditAction.USER_ACTIVATED if instance.is_active else AuditAction.USER_DEACTIVATED,
                actor=actor,
                target_user=instance,
                request=self.request,
            )

    def destroy(self, request, *args, **kwargs):
        # Soft delete by deactivation — never hard-delete users with audit history.
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=['is_active'])
        record(
            AuditAction.USER_DEACTIVATED,
            actor=request.user,
            target_user=user,
            request=request,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def reissue_invite(self, request, pk=None):
        user = self.get_object()
        InviteToken.objects.filter(user=user).delete()
        invite = InviteToken.objects.create(user=user, invited_by=request.user)
        return Response(
            {
                'token': invite.token,
                'expires_at': invite.expires_at,
                'setup_url': f'/setup-password?token={invite.token}',
            }
        )
