#!/bin/sh
# Build command for the Vercel api service (see vercel.json).
#
# The function ships apps/api/dist as its root, so @clearplate/targets has to
# live under dist/node_modules: the workspace symlink in apps/api/node_modules
# is outside the function root and cannot be resolved from /var/task/main.js.
# The package has no dependencies, so its package.json and dist are enough.
set -e
cd "$(dirname "$0")/.."

pnpm --filter @clearplate/targets build
pnpm --filter @clearplate/api build

target=apps/api/dist/node_modules/@clearplate/targets
mkdir -p "$target"
cp -R packages/targets/package.json packages/targets/dist "$target/"
