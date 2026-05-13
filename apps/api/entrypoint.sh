#!/bin/sh
# Versuitality API entrypoint.
#
# Cold-start order:
#   1. wait for Postgres to actually accept connections (not just its
#      docker healthcheck — pg_isready often flips green a beat before
#      the server is ready),
#   2. generate any missing migrations,
#   3. run them,
#   4. exec the server passed via $@ (defaults to runserver for dev).
#
# On Windows hosts make sure this file is saved with LF line endings —
# CRLF would otherwise cause `/usr/bin/env: 'sh\r': No such file...`.

set -e

POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

echo "[versuitality] waiting for postgres at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
python - <<'PY'
import os
import socket
import sys
import time

host = os.environ.get("POSTGRES_HOST", "postgres")
port = int(os.environ.get("POSTGRES_PORT", "5432"))

for attempt in range(1, 61):
    try:
        with socket.create_connection((host, port), timeout=2):
            print(f"[versuitality] postgres reachable at {host}:{port} (attempt {attempt})")
            sys.exit(0)
    except OSError:
        if attempt % 5 == 0:
            print(f"[versuitality] ...still waiting (attempt {attempt}/60)")
        time.sleep(1)

print(f"[versuitality] FATAL: gave up after 60s waiting for {host}:{port}", file=sys.stderr)
sys.exit(1)
PY

echo "[versuitality] running makemigrations..."
python manage.py makemigrations --noinput

echo "[versuitality] running migrate..."
python manage.py migrate --noinput

if [ "$#" -eq 0 ]; then
    echo "[versuitality] starting dev server on 0.0.0.0:8000..."
    exec python manage.py runserver 0.0.0.0:8000
fi

echo "[versuitality] launching: $*"
exec "$@"
