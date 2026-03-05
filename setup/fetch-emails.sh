#!/bin/bash
#
# Fetch latest 100 emails from the VM and copy them to your local machine.
#
# Usage:
#   ./setup/fetch-emails.sh user@vm-host /path/to/KI-Tagesmappe
#
# Example:
#   ./setup/fetch-emails.sh admin@192.168.1.50 /opt/ki-tagesmappe

set -e

if [ $# -lt 2 ]; then
  echo "Usage: $0 <user@vm-host> <remote-project-path>"
  echo "Example: $0 admin@192.168.1.50 /opt/ki-tagesmappe"
  exit 1
fi

VM_HOST="$1"
REMOTE_PATH="$2"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)/emails"

echo "==> Running pull-emails.js on ${VM_HOST}..."
ssh "$VM_HOST" "cd ${REMOTE_PATH} && node setup/pull-emails.js"

echo "==> Copying emails to ${LOCAL_DIR}..."
mkdir -p "$LOCAL_DIR"
scp -r "${VM_HOST}:${REMOTE_PATH}/setup/emails/" "$LOCAL_DIR/"

COUNT=$(ls -1 "$LOCAL_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
echo "==> Done. ${COUNT} emails downloaded to ${LOCAL_DIR}/"
