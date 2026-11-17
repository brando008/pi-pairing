#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SERVER_URL=${PI_PAIRING_URL:-http://127.0.0.1:4173}
STATE_DIR=$(node -e '
    const StateStore = require(process.argv[1])
    console.log(StateStore.defaultDataDirectory())
' "$ROOT_DIR/state-store.js")
PID_FILE=$STATE_DIR/server.pid
LOG_FILE=$STATE_DIR/server.log

if curl -fsS "$SERVER_URL/api/state" >/dev/null 2>&1; then
    echo "Pi Pairing is already running at $SERVER_URL"
    exit 0
fi

SERVER_PORT=$(SERVER_URL="$SERVER_URL" node -e '
    const url = new URL(process.env.SERVER_URL)
    console.log(url.port || (url.protocol === "https:" ? "443" : "80"))
')

mkdir -p "$STATE_DIR"
PORT="$SERVER_PORT" nohup node "$ROOT_DIR/server.js" >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" >"$PID_FILE"

attempt=0
while [ "$attempt" -lt 40 ]; do
    if curl -fsS "$SERVER_URL/api/state" >/dev/null 2>&1; then
        echo "Pi Pairing is running at $SERVER_URL"
        exit 0
    fi

    attempt=$((attempt + 1))
    sleep 0.1
done

echo "Pi Pairing did not start. See $LOG_FILE" >&2
exit 1
