#!/bin/sh
# Production entrypoint (Cloud Run): apply committed migrations, then serve
# HTTP + WebSockets with Daphne on $PORT. Unlike the dev entrypoint this never
# runs makemigrations — migrations must come from git.
set -e

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
    echo "[versuitality] applying migrations..."
    python manage.py migrate --noinput
fi

if [ "${ENABLE_RLS_LOCKDOWN:-1}" = "1" ]; then
    echo "[versuitality] locking down the database Data API (RLS)..."
    python manage.py enable_rls
fi

echo "[versuitality] starting daphne on 0.0.0.0:${PORT:-8080}"
exec daphne -b 0.0.0.0 -p "${PORT:-8080}" --proxy-headers versuitality.asgi:application
