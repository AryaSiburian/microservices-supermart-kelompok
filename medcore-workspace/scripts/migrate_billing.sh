#!/bin/sh
set -eu
root=$(CDPATH= cd "$(dirname "$0")/.." && pwd)
# Only adds the Billing deduplication table; never resets existing invoice data.
docker exec -i "${BILLING_DB_CONTAINER:-medcore-billing-db}" sh -c \
  'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql --protocol=tcp -h 127.0.0.1 -u "$MYSQL_USER" "$MYSQL_DATABASE"' \
  < "$root/services/billing-service/ddl/002_processed_events.sql"
