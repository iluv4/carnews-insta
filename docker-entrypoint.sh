#!/bin/sh
# Run pending database migrations, then start the Next.js standalone server.
# Safe to run on every boot: the migrator skips already-applied migrations and
# no-ops when no database is configured.
set -e

node scripts/migrate-deploy.mjs
exec node server.js
