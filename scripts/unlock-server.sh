#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
STATE_DIR=$(node -e '
    const StateStore = require(process.argv[1])
    console.log(StateStore.defaultDataDirectory())
' "$ROOT_DIR/state-store.js")
STATE_FILE=${PI_PAIRING_STATE_FILE:-$STATE_DIR/state.json}

PI_PAIRING_STATE_FILE="$STATE_FILE" node -e '
    const StateStore = require(process.argv[1])
    const store = new StateStore(process.env.PI_PAIRING_STATE_FILE)
    store.clearStaleLock()
    console.log("Cleared any stale Pi Pairing lock.")
' "$ROOT_DIR/state-store.js"
