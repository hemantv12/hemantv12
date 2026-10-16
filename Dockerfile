FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY .earnroute-payload-v2/ /tmp/earnroute-payload/
RUN cat /tmp/earnroute-payload/part-*.b64 | base64 --decode > /tmp/earnroute-source.tar.gz \
    && tar -xzf /tmp/earnroute-source.tar.gz --strip-components=1 -C /app \
    && rm -rf /tmp/earnroute-payload /tmp/earnroute-source.tar.gz
RUN python -m pip install --upgrade pip && pip install -r requirements.txt
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
