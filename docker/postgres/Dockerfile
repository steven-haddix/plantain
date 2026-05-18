FROM postgis/postgis:17-3.5

RUN echo 'Acquire::Retries "5";' > /etc/apt/apt.conf.d/80-retries \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-17-pgvector \
  && rm -rf /var/lib/apt/lists/*

COPY docker/postgres/init/01-extensions.sql /docker-entrypoint-initdb.d/01-extensions.sql
