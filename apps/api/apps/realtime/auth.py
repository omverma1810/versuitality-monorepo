"""JWT-based authentication middleware for Channels WebSockets.

Browsers cannot set arbitrary headers on a WebSocket connection so we accept
the access token as the `token` query-string parameter. Bring-your-own
mechanism: clients fetch the token from the auth store and append it.
"""
from __future__ import annotations

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()


@database_sync_to_async
def _user_from_token(raw_token: str):
    try:
        token = AccessToken(raw_token)
        user_id = token['user_id']
    except (InvalidToken, TokenError, KeyError):
        return AnonymousUser()
    try:
        return User.objects.get(id=user_id, is_active=True)
    except User.DoesNotExist:
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get('query_string', b'').decode())
        token_list = query.get('token', [])
        token = token_list[0] if token_list else None
        scope['user'] = await _user_from_token(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)
