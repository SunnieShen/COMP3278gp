#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MYSQL_HOST="${MYSQL_HOST:-localhost}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_DATABASE="${MYSQL_DATABASE:-group_eats}"

if [[ ! "$MYSQL_DATABASE" =~ ^[A-Za-z0-9_]+$ ]]; then
    printf 'MYSQL_DATABASE must contain only letters, numbers, and underscores.\n' >&2
    exit 2
fi

if ! command -v mysql >/dev/null 2>&1; then
    printf 'The MySQL client (mysql) is required but was not found in PATH.\n' >&2
    exit 127
fi

{
    printf 'CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;\n' "$MYSQL_DATABASE"
    printf 'USE `%s`;\n' "$MYSQL_DATABASE"
    cat "$SCRIPT_DIR/schema.sql"
} | mysql --host="$MYSQL_HOST" --port="$MYSQL_PORT" --user="$MYSQL_USER" --password

printf 'Schema imported into database `%s`.\n' "$MYSQL_DATABASE"
