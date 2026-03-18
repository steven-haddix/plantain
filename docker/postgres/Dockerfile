FROM postgis/postgis:17-3.5

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    git \
    postgresql-server-dev-17 \
  && git clone --branch v0.8.0 --depth 1 https://github.com/pgvector/pgvector.git /tmp/pgvector \
  && make -C /tmp/pgvector \
  && make -C /tmp/pgvector install \
  && rm -rf /tmp/pgvector \
  && apt-get purge -y --auto-remove \
    build-essential \
    git \
    postgresql-server-dev-17 \
  && rm -rf /var/lib/apt/lists/*

COPY docker/postgres/init/01-extensions.sql /docker-entrypoint-initdb.d/01-extensions.sql
