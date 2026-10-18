#!/usr/bin/env bash
# Gagal jika repo memakai SDK/API Anthropic. Pemilik repo melarangnya.
set -euo pipefail
if git grep -nIiE 'anthropic|api\.anthropic\.com' -- . \
     ':!CLAUDE.md' ':!.claude/' ':!scripts/check-llm-provider.sh'; then
  echo "DITOLAK: ditemukan jejak Anthropic di atas. Hapus sebelum commit." >&2
  exit 1
fi
echo "OK: tidak ada SDK/API Anthropic."
