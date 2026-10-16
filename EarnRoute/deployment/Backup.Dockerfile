FROM postgres:16-bookworm
ENV DEBIAN_FRONTEND=noninteractive PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-boto3 gnupg ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 --shell /usr/sbin/nologin backup
COPY EarnRoute/deployment/backup_postgres.py /opt/earnroute/backup_postgres.py
RUN chmod 0555 /opt/earnroute/backup_postgres.py
USER backup
ENTRYPOINT ["python3", "/opt/earnroute/backup_postgres.py"]
