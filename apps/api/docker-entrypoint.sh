#!/bin/sh
# Migrate, seed the starter catalogue (idempotent), then start the API.
set -e
node dist/db/migrate.js
node dist/db/seed.js
exec node dist/main.js
