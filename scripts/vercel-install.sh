#!/bin/sh
# Install command for both Vercel services (see vercel.json).
#
# Vercel's NestJS builder makes the API's dist/ the function root, so main.js
# runs from /var/task/main.js and only finds packages in /var/task/node_modules.
# pnpm's default layout keeps packages in node_modules/.pnpm behind symlinks in
# apps/api/node_modules, which the function never sees. A hoisted layout puts
# real package directories in the root node_modules, which the builder ships
# at /var/task/node_modules.
#
# Both services must use the same layout: they install into the same checkout,
# and a second install with another layout would move the files the first
# service's function points at.
set -e
cd "$(dirname "$0")/.."

# Vercel's build cache can restore an isolated install, and pnpm leaves its
# symlinks behind when switching layouts. Start clean unless it is already hoisted.
if ! grep -qs 'nodeLinker: hoisted' node_modules/.modules.yaml; then
  rm -rf node_modules apps/*/node_modules packages/*/node_modules
fi

pnpm install --frozen-lockfile --config.node-linker=hoisted
