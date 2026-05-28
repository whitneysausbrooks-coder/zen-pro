#!/usr/bin/env bash
# Generate a per-pilot QR code that links directly to the /join page with the
# invite code pre-filled. Saves to `attached_assets/pilots/<slug>_qr.png`.
#
# Usage:
#   ./scripts/generate-pilot-qr.sh <INVITE_CODE> <COMPANY_NAME>
#
# Example:
#   ./scripts/generate-pilot-qr.sh K7P9X2MN "Acme Corp"
#   → attached_assets/pilots/acme-corp_K7P9X2MN_qr.png
#
# The QR encodes: https://neuroquestzen.pro/join?code=<INVITE_CODE>
# When scanned, opens the join page with the code already filled in and the
# company lookup auto-triggered — participant just enters name + email.

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <INVITE_CODE> <COMPANY_NAME>" >&2
  echo "Example: $0 K7P9X2MN \"Acme Corp\"" >&2
  exit 1
fi

CODE="$(echo "$1" | tr '[:lower:]' '[:upper:]' | tr -cd 'A-Z0-9')"
COMPANY="$2"
DOMAIN="${NEUROQUEST_DOMAIN:-neuroquestzen.pro}"

if [ ${#CODE} -lt 4 ]; then
  echo "Error: invite code must be at least 4 characters (got '$CODE')" >&2
  exit 1
fi

SLUG="$(echo "$COMPANY" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//')"
OUTDIR="attached_assets/pilots"
OUT="${OUTDIR}/${SLUG}_${CODE}_qr.png"
URL="https://${DOMAIN}/join?code=${CODE}"

mkdir -p "$OUTDIR"

echo "Generating QR for ${COMPANY} (code ${CODE})"
echo "  Target URL: ${URL}"
echo "  Output:     ${OUT}"

curl -sS --fail \
  -o "$OUT" \
  "https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=20&ecc=H&data=$(printf '%s' "$URL" | sed 's/:/%3A/g;s/\//%2F/g;s/?/%3F/g;s/=/%3D/g')"

if [ ! -s "$OUT" ]; then
  echo "Error: QR generation failed (empty file)" >&2
  exit 1
fi

echo "✓ Saved ${OUT} ($(wc -c < "$OUT") bytes)"
echo ""
echo "Next steps:"
echo "  1. Email the PNG + invite code to: <admin>"
echo "  2. They share with their team — scanning opens the join page with code pre-filled"
echo "  3. Participant enters name + email, joins the pilot"
