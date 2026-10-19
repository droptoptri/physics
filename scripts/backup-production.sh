#!/usr/bin/env bash
# A consistent private snapshot; the app is briefly unavailable while files are copied.
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
mkdir -p backups
snapshot="backups/sgt-$(date -u +%Y%m%dT%H%M%S)-$$.tar.gz"
compose=(docker compose --env-file .env.production)
"${compose[@]}" exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
"${compose[@]}" stop app
trap '"${compose[@]}" start app >&2' EXIT
"${compose[@]}" run --rm --no-deps -T --entrypoint tar app -C /app/var -czf - . > "$snapshot.partial"
gzip -t "$snapshot.partial"
mv "$snapshot.partial" "$snapshot"
"${compose[@]}" start app
trap - EXIT
printf 'Backup saved: %s\n' "$snapshot"
