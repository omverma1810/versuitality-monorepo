# Production image for the Versuitality API (Cloud Run).
# Local development uses Dockerfile.dev via docker-compose.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080

WORKDIR /app

# psycopg[binary] and Pillow ship wheels, so no compiler / libpq needed.
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

# Collect admin/DRF static files so WhiteNoise can serve them. The values are
# placeholders used only for this build step; real ones come from Cloud Run.
RUN DJANGO_DEBUG=0 DJANGO_SECRET_KEY=build-only python manage.py collectstatic --noinput

RUN sed -i 's/\r$//' /app/entrypoint.prod.sh && chmod +x /app/entrypoint.prod.sh \
    && useradd --system --uid 10001 app \
    && mkdir -p /app/media && chown -R app /app/media
USER app

EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.prod.sh"]
