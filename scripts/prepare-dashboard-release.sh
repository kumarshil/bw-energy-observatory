#!/usr/bin/env bash
set -euo pipefail

# Creates a clean, dashboard-only folder for a separate GitHub repository.
# The source workspace is not moved or deleted, so the Next.js portfolio stays intact.

project_root="$(cd "$(dirname "$0")/.." && pwd)"
target="${1:-"$project_root/dist/bw-energy-observatory"}"

if [[ -e "$target" && -n "$(find "$target" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
  printf 'Refusing to overwrite non-empty release folder: %s\n' "$target" >&2
  exit 1
fi

mkdir -p "$target/docs"
tar -C "$project_root" \
  --exclude='*/__pycache__' \
  --exclude='*.pyc' \
  --exclude='.DS_Store' \
  -cf - app static tests .github | tar -C "$target" -xf -
cp "$project_root/docs/PRD.md" "$project_root/docs/architecture.md" "$project_root/docs/design.md" "$project_root/docs/memory.md" "$project_root/docs/phases.md" "$project_root/docs/rules.md" "$target/docs/"
cp "$project_root/README.md" "$project_root/LICENSE" "$project_root/.gitignore" "$project_root/config.example" "$target/"

printf 'Dashboard release prepared at: %s\n' "$target"
printf 'Next: cd "%s" && git init && git add . && git commit -m "Initial dashboard release"\n' "$target"
