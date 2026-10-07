from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import AuditLog, InviteToken, Role, User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            'id',
            'email',
            'full_name',
            'role',
            'phone',
            'avatar_url',
            'is_active',
            'last_login',
            'created_at',
        )
        read_only_fields = ('id', 'last_login', 'created_at')


class MeSerializer(UserSerializer):
    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ('is_superuser',)


class InviteUserSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=120)
    role = serializers.ChoiceField(choices=Role.choices)

    def validate_email(self, value: str) -> str:
        value = value.lower().strip()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value


class UpdateUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('full_name', 'role', 'phone', 'avatar_url', 'is_active')


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class SetupPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Passwords do not match.'})
        try:
            invite = InviteToken.objects.select_related('user').get(token=attrs['token'])
        except InviteToken.DoesNotExist:
            raise serializers.ValidationError({'token': 'Invalid or expired invitation.'})
        if not invite.is_valid:
            raise serializers.ValidationError({'token': 'This invitation is no longer valid.'})
        try:
            validate_password(attrs['password'], user=invite.user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        attrs['invite'] = invite
        return attrs


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    actor_email = serializers.SerializerMethodField()
    target_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = (
            'id', 'action', 'actor_name', 'actor_email', 'target_name',
            'metadata', 'ip_address', 'created_at',
        )
        read_only_fields = fields

    def get_actor_name(self, obj):
        return obj.actor.full_name if obj.actor_id else 'System'

    def get_actor_email(self, obj):
        return obj.actor.email if obj.actor_id else ''

    def get_target_name(self, obj):
        return obj.target_user.full_name if obj.target_user_id else ''
