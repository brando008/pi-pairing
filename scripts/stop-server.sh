#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
STATE_DIR=$(node -e '
    const StateStore = require(process.argv[1])
    console.log(StateStore.defaultDataDirectory())
' "$ROOT_DIR/state-store.js")
PID_FILE=$STATE_DIR/server.pid
STATE_FILE=${PI_PAIRING_STATE_FILE:-$STATE_DIR/state.json}

if [ ! -f "$PID_FILE" ]; then
    echo "Pi Pairing is not running (no PID file)."
    exit 0
fi

SERVER_PID=$(cat "$PID_FILE")

if kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID"

    attempt=0
    while kill -0 "$SERVER_PID" 2>/dev/null && [ "$attempt" -lt 20 ]; do
        attempt=$((attempt + 1))
        sleep 0.1
    done

    echo "Stopped Pi Pairing (PID $SERVER_PID)."
else
    echo "Pi Pairing was not running; removed stale PID file."
fi

rm -f "$PID_FILE"

PI_PAIRING_STATE_FILE="$STATE_FILE" node -e '
    const StateStore = require(process.argv[1])
    const store = new StateStore(process.env.PI_PAIRING_STATE_FILE)
    try {
        store.clearStaleLock()
    } catch (error) {
        if (!/still owned/.test(error.message)) {
            throw error
        }
    }
' "$ROOT_DIR/state-store.js"
