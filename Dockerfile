FROM python:3.12-slim

WORKDIR /app
# Keep the process unprivileged even if the collector ever receives malformed input.
RUN addgroup --system --gid 10001 smalltv \
    && adduser --system --uid 10001 --gid 10001 smalltv
COPY --chown=10001:10001 companion/ /app/companion/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SMALLTV_BRIDGE_HOST=0.0.0.0 \
    SMALLTV_BRIDGE_PORT=4310 \
    SMALLTV_PUSH_INTERVAL_SEC=10

EXPOSE 4310

# The host publishes this port only on loopback; 0.0.0.0 is needed inside Docker.
USER 10001:10001

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import json,urllib.request; data=json.load(urllib.request.urlopen('http://127.0.0.1:4310/provider-event', timeout=3)); raise SystemExit(0 if data.get('bridge') == 'ready' else 1)"

CMD ["python", "/app/companion/companion.py"]
