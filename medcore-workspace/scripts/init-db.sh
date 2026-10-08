#!/usr/bin/env bash
set -e

# Load .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

DB_HOST="${MYSQL_HOST:-127.0.0.1}"
DB_PORT="${MYSQL_PORT:-3306}"
DB_USER="${MYSQL_USER:-nusantara_user}"
DB_PASS="${MYSQL_PASSWORD:-nusantara_secret}"
DB_NAME="${MYSQL_DATABASE:-nusantara_db}"
ROOT_PASS="${MYSQL_ROOT_PASSWORD:-root_secret}"

echo "==> Initializing Nusantara SuperMart Database on ${DB_HOST}:${DB_PORT}..."

# Wait for MySQL to be ready
until mysqladmin ping -h "${DB_HOST}" -P "${DB_PORT}" -u root -p"${ROOT_PASS}" --silent 2>/dev/null; do
  echo "Waiting for MySQL server at ${DB_HOST}:${DB_PORT}..."
  sleep 2
done

echo "==> Applying schema db.sql..."
mysql -h "${DB_HOST}" -P "${DB_PORT}" -u root -p"${ROOT_PASS}" < db.sql

echo "==> Applying seed data seed.sql..."
mysql -h "${DB_HOST}" -P "${DB_PORT}" -u root -p"${ROOT_PASS}" < seed.sql

echo "==> Database initialization complete!"
