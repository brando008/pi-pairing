#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PI_AGENT_DIR=${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}
SKILL_DIR=$PI_AGENT_DIR/skills/pi-pairing
BIN_DIR=$PI_AGENT_DIR/bin
PURGE_DATA=0

for argument in "$@"; do
    case "$argument" in
        --purge-data) PURGE_DATA=1 ;;
        *) echo "Unknown option: $argument" >&2; exit 1 ;;
    esac
done

"$ROOT_DIR/scripts/stop-server.sh" || true

if [ -e "$SKILL_DIR" ] || [ -L "$SKILL_DIR" ]; then
    rm -rf "$SKILL_DIR"
    echo "Removed the pi-pairing skill."
fi

rm -f "$BIN_DIR/pi-pairing" "$BIN_DIR/pi-pairing.cmd"
echo "Removed the CLI wrapper."

if [ "$PURGE_DATA" -eq 1 ]; then
    STATE_DIR=$(node -e '
        const StateStore = require(process.argv[1])
        console.log(StateStore.defaultDataDirectory())
    ' "$ROOT_DIR/state-store.js")
    rm -rf "$STATE_DIR"
    echo "Removed the Pi Pairing data directory ($STATE_DIR)."
fi
